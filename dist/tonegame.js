/// <reference path="../typings/globals/jquery/index.d.ts" />

//TODO:
//custom level generator
//try different tone generator library to see if it is better
//see if we can improve pitch detection. maybe allow settings to adjust some of the detector settings.

const DEBUG = false;
// const Pitchfinder = require("pitchfinder");
window.AudioContext = window.AudioContext || window.webkitAudioContext;

//canvas constants
const canvasHeight = 500; //px
var canvasLeftMargin = 200; //pixels between left of canvas and time=0 line
const ppms = 0.05; //canvas pixels per ms
var timePerNote = 1000; //ms
var timePerRest = 1000; //ms
if (DEBUG) {
  timePerNote = 500; //ms
  timePerRest = 500; //ms
}
const restInterval = 4; //notes between each rest
const initialRest = 1000; //ms
const finishRest = 2000; //ms
const staffColors = ["LimeGreen", "gray", "salmon", "gray", "yellow", "DeepSkyBlue", "gray", "crimson", "gray", "orange", "gray", "violet"];
const noteColors = ["LimeGreen", "salmon", "yellow", "DeepSkyBlue", "crimson", "orange", "violet"];
const notePosition = [0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24, 25];
const rowHeight = 20;
const noteWidth = timePerNote * ppms;
const noteHeight = 16;

//canvas/animation variables
var staffCanvas, gameCanvas, canvasWidth, dpr;
var myAniReq = null;

//jquery variables
var $score, $progress, $staff, $game, $board, $startgame, $newgame, $stopgame, $resettab;
var $notesel, $debuginfo, $newtab, $settingstab, $helptab, $showsettings, $scorelist;

//variables for audiocontext and playing tones
var audioContext = null;
var stream = null;
var analyser = null;
var mediaStreamSource = null;
var detectPitch = null;
var piano = null;
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

//pitch variables
const pitchAvgLength = 5;
var pitchArray = [];
var arrowPosition = 250; //position of the arrow at start of game. Updates as game is played
const pitchFoundThresh = 5; //how many samples have to be null before we consider no pitch found
var pitchFound = 0; //countdown until we consider no pitch found (resets to pitchFoundThresh when detected)

//song variables
var notes = []; //8=tonic
var tonic = null; //C4=60
var userMiddleNote = 57;
var startTime = null;
var finishTime = null;
var time = null;
var currentNote = 0;
var prevNote = 0;
var selectedLevel = 1;

//scoring variables
var noteScoreArray = [];
var currentScore = 0;
var currentProgress = 0;
const perfScoreVal = 1;

//scope variables
var xdata = [];
var ydata = [];

$(document).ready(function () {
  //find jquery elements
  $staff = $("#staff");
  $game = $("#game");
  $board = $(".board");
  $score = $(".score");
  $progress = $(".progress");
  $startgame = $(".startgame");
  $showsettings = $(".showsettings");
  $newgame = $(".newgame");
  $stopgame = $(".stopgame");
  $notesel = $(".notesel");
  $debuginfo = $(".debuginfo");
  $newtab = $(".newtab");
  $settingstab = $(".settingstab");
  $resettab = $(".resettab");
  $helptab = $(".helptab");
  $scorelist = $(".scorelist");

  dpr = window.devicePixelRatio || 1;
  let w = window.innerWidth;
  canvasWidth = Math.min(w - 20, 800);
  $board.width(canvasWidth);
  $staff[0].width = canvasWidth * dpr;
  $game[0].width = canvasWidth * dpr;
  $staff[0].height = canvasHeight * dpr;
  $game[0].height = canvasHeight * dpr;
  $staff[0].style.width = canvasWidth + "px";
  $game[0].style.width = canvasWidth + "px";
  $staff[0].style.height = canvasHeight + "px";
  $game[0].style.height = canvasHeight + "px";

  gameCanvas = $game[0].getContext("2d");
  gameCanvas.scale(dpr, dpr);
  staffCanvas = $staff[0].getContext("2d");
  staffCanvas.scale(dpr, dpr);
  canvasLeftMargin = Math.min(200, Math.round(canvasWidth / 2));
  drawStaff();

  //initialize the synthesizer upon page load
  piano = Synth.createInstrument("piano");
  Synth.setSampleRate(48000); // sets sample rate [Hz]
  Synth.setVolume(0.5); // set volume [0-1]

  //load cookies
  let firstvisit = loadCookies();
  if (firstvisit) {
    hideTabs();
    $helptab.show();
  }

  $stopgame.click(function () {
    stopGame();
  });

  $newgame.click(function () {
    hideTabs();
    loadCookies();
    $newtab.show();
  });

  $startgame.click(function () {
    hideTabs();
    startGame(false);
  });

  $("button.levelsel").click(function () {
    selectedLevel = parseInt($(this).val());
    console.log("Level: " + selectedLevel);
    hideTabs();
    startGame(true);
  });

  $("button.applysettings").click(function () {
    userMiddleNote = parseInt($notesel.val());
    console.log("Middle Note: " + userMiddleNote);
    Cookies.set("middlenote", userMiddleNote, { expires: 3650 });
    hideTabs();
  });

  $showsettings.click(function () {
    hideTabs();
    loadCookies();
    $settingstab.show();
  });

  $("button.resetprog").click(function () {
    $resettab.show();
  });

  $("button.confirmreset").click(function () {
    clearProgress();
    hideTabs();
  });

  $("button.showhelp").click(function () {
    hideTabs();
    $helptab.show();
  });

  $("button.closetab").click(function () {
    hideTabs();
  });
});

function hideTabs() {
  $newtab.hide();
  $settingstab.hide();
  $helptab.hide();
  $resettab.hide();
}

function clearProgress() {
  console.log("clearing progress");
  var count = $(".scorelist").children().length;
  for (let i = 1; i <= count; i++) {
    Cookies.remove(i);
  }
}

function loadCookies() {
  //First load any saved settings
  let firstvisit = false;
  userMiddleNote = Cookies.get("middlenote");
  if (userMiddleNote == undefined) {
    firstvisit = true;
    userMiddleNote = 57; //default to A3
    Cookies.set("middlenote", userMiddleNote, { expires: 3650 });
  }
  $notesel.val(userMiddleNote);

  //Then load Scores
  var count = $(".scorelist").children().length;
  for (let i = 1; i <= count; i++) {
    let myScore = Cookies.get(i);
    if (myScore != undefined) {
      myScore = parseFloat(myScore);
      $(".scorelist")
        .children()
        .eq(i)
        .html(myScore.toFixed(myScore > 99.95 ? 0 : 1) + "%");
    } else {
      $(".scorelist").children().eq(i).html("--");
    }
  }

  //let the page know if it is the user's first visit
  return firstvisit;
}

function startSong() {
  startTime = new Date().getTime();
  let numNotes = notes.length;
  let numRests = Math.floor(numNotes / restInterval);
  finishTime = initialRest + numRests * timePerRest + numNotes * timePerNote + finishRest;
}

function stopSong() {
  startTime = null;
  gameCanvas.clearRect(0, 0, canvasWidth, canvasHeight);
  window.cancelAnimationFrame(myAniReq);
}

function calcAvgPitch() {
  let myPitch = 0;
  var total = 0;
  var minval = Infinity;
  var maxval = -Infinity;
  for (var i = 0; i < pitchArray.length; i++) {
    tempval = pitchArray[i];
    total += tempval;
    if (tempval < minval) minval = tempval;
    if (tempval > maxval) maxval = tempval;
  }
  if (pitchArray.length < pitchAvgLength) {
    myPitch = total / pitchArray.length;
  } else {
    myPitch = (total - minval - maxval) / (pitchArray.length - 2);
  }
  return myPitch;
}

function renderFrame() {
  if (startTime != null) {
    //figure out time step since start of game
    time = new Date().getTime();
    let dt = time - startTime;

    //clear old canvas
    gameCanvas.clearRect(0, 0, canvasWidth, canvasHeight);

    //draw notes
    currentNote = 0;
    let noteCenter = -100;
    gameCanvas.lineWidth = 1;
    gameCanvas.strokeStyle = "black";
    for (let i = 0; i < notes.length; i++) {
      let myNote = notes[i];
      let myNoteRel = ((myNote - 1) % 7) + 1;
      let myColor = noteColors[myNoteRel - 1];
      let numRests = Math.floor(i / restInterval);
      let myX = canvasLeftMargin + (initialRest + numRests * timePerRest - dt) * ppms + i * noteWidth;
      let myY = canvasHeight - notePosition[myNote] * rowHeight + (rowHeight - noteHeight) / 2;
      let myWidth = noteWidth;
      let myHeight = rowHeight * 0.8;
      if (myX > -noteWidth && myX < canvasWidth) {
        //only draw the notes that are on screen
        gameCanvas.fillStyle = myColor;
        gameCanvas.beginPath();
        gameCanvas.rect(myX, myY, myWidth, myHeight);
        gameCanvas.fill();
        gameCanvas.stroke();
        gameCanvas.fillStyle = "black";
        gameCanvas.font = "16px Arial";
        gameCanvas.fillText(myNoteRel, myX + 10, myY + 14);
      }
      //see if the note is currently the active note
      if (myX < canvasLeftMargin && myX + myWidth > canvasLeftMargin) {
        currentNote = myNote;
        noteCenter = myY + noteHeight / 2;
      }
    }
    //calculate current pitch
    let noteScaled = null;
    if (pitchArray.length > 0) {
      let myPitch = calcAvgPitch();
      if (DEBUG) $debuginfo.html(noteNameFromNum(Math.round(myPitch)));
      noteScaled = canvasHeight - 10 - (myPitch - tonic + 12) * rowHeight;
      arrowPosition = Math.min(Math.max(noteScaled, 0), canvasHeight); //clip to available canvas
      //arrow Position only updates if pitchArray is not empty
    }
    xdata.push(canvasLeftMargin + dt * ppms);
    ydata.push(noteScaled);

    //calculate whether it is currently scoring
    let scoring = 0;
    if (arrowPosition < noteCenter + 5 && arrowPosition > noteCenter - 5 && pitchFound > 0) {
      scoring = 2;
    } else if (arrowPosition < noteCenter + 10 && arrowPosition > noteCenter - 10 && pitchFound > 0) {
      scoring = 1;
    }
    //if current note is new, then calculate the previous note's score
    if (currentNote != prevNote) {
      if (prevNote > 0) {
        // only score the previous note if it was not a rest
        let noteScore = 0;
        for (var i = 0; i < noteScoreArray.length; i++) {
          noteScore = noteScore + noteScoreArray[i];
        }
        noteScore = Math.min(noteScore / noteScoreArray.length, perfScoreVal); //don't let it go over the max score value
        //scale it to a percentage of the total
        let scaledScore = ((noteScore / perfScoreVal) * 100) / notes.length;
        currentScore = currentScore + scaledScore;
        currentProgress = currentProgress + 100 / notes.length;
      }
      noteScoreArray = [];
    }
    //then append the new score if we are not on a rest currently
    if (currentNote > 0) {
      noteScoreArray.push(scoring);
    }
    prevNote = currentNote;

    //update game info
    let scorestr = currentScore.toFixed(currentScore > 99.95 ? 0 : 1) + "%";
    let progstr = currentProgress.toFixed(currentProgress > 99.95 ? 0 : 1) + "%";
    $score.html(scorestr);
    $progress.html(progstr);

    //draw scope
    let xdata_shift = xdata.map((x) => x - dt * ppms);
    let drawing = false;
    gameCanvas.lineWidth = 3;
    gameCanvas.beginPath();
    for (let i = 0; i < xdata_shift.length; i++) {
      if (ydata[i] == null) {
        drawing = false;
      } else {
        if (!drawing) {
          gameCanvas.moveTo(xdata_shift[i], ydata[i]);
          drawing = true;
        } else {
          gameCanvas.lineTo(xdata_shift[i], ydata[i]);
        }
      }
    }
    gameCanvas.stroke();

    //delete old samples if they are now off screen
    if (xdata_shift[0] < 0) {
      xdata.shift();
      ydata.shift();
    }

    //draw arrow
    if (scoring > 0) {
      gameCanvas.strokeStyle = "black";
      gameCanvas.fillStyle = "green";
    } else {
      gameCanvas.strokeStyle = "black";
      gameCanvas.fillStyle = "black";
    }
    gameCanvas.lineWidth = 1;
    gameCanvas.beginPath();
    gameCanvas.moveTo(canvasLeftMargin, arrowPosition);
    gameCanvas.lineTo(canvasLeftMargin - 20, arrowPosition + 10);
    gameCanvas.lineTo(canvasLeftMargin - 20, arrowPosition - 10);
    gameCanvas.lineTo(canvasLeftMargin, arrowPosition);
    gameCanvas.fill();
    gameCanvas.stroke();

    //see if the game is over
    if (dt > finishTime && !DEBUG) {
      stopGame();
    }
  }
}

async function getMedia() {
  if (stream == null) {
    // try {
    audioContext = new AudioContext();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    sampleRate = audioContext.sampleRate;
    console.log(sampleRate);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect(analyser);

    // Initialize the pitch detector
    // detectPitch = Pitchfinder.AMDF({
    detectPitch = AMDF({
      sampleRate: sampleRate,
      minFrequency: 78,
      maxFrequency: 1000,
      ratio: 5,
      sensitivity: 0.1,
    });

    // detectPitch = Pitchfinder.YIN({
    //   sampleRate: sampleRate,
    //   threshold: 0.1,
    //   probabilityThreshold: 0.1,
    // });

    return true;
    // } catch (err) {
    //   console.log("failed to get stream");
    //   alert(
    //     "Can't access microphone. Make sure you allow microphone access, and nothing else is using the microphone. \nIf this still doesn't work, you may need to restart your device."
    //   );
    //   return false;
    // }
  }
}

function stopGame() {
  $stopgame.prop("disabled", true);
  $startgame.prop("disabled", false);
  $newgame.prop("disabled", false);
  $showsettings.prop("disabled", false);
  if (stream != null) {
    stream.getAudioTracks().forEach((track) => {
      track.stop();
    });
    console.log("stopping mic");
    stream = null;
    audioContext.close();
  }
  //save score
  let bestScore = Cookies.get(selectedLevel);
  if (bestScore == undefined || currentScore > bestScore) {
    Cookies.set(selectedLevel, Math.round(currentScore * 10) / 10, { expires: 3650 });
  }
  stopSong();
}

async function startGame(newgame) {
  let connection = false;
  connection = await getMedia(); //get the microphone working
  if (connection) {
    stopSong();
    $startgame.prop("disabled", true);
    $newgame.prop("disabled", true);
    $showsettings.prop("disabled", true);
    //reset everything
    currentScore = 0;
    currentProgress = 0;
    prevNote = 0;
    xdata = [];
    ydata = [];
    pitchFound = 0;
    $score.html("--");
    $progress.html("--");
    if (newgame || notes.length < 1) {
      let level = selectedLevel;
      console.log("Level: " + level);
      getMelody(level); //generate the melody notes
    }

    //set the tonic to get midpoint = userMiddleNote
    let maxNote = Math.max(...notes);
    let minNote = Math.min(...notes);
    let midPoint = Math.round((notePosition[maxNote] + notePosition[minNote]) / 2);
    tonic = userMiddleNote - (midPoint - notePosition[8]);
    console.log("Middle Note: " + noteNameFromNum(userMiddleNote));
    console.log("Tonic Note: " + noteNameFromNum(tonic));
    console.log("Notes: " + notes.map((x) => noteNameFromNum(notePosition[x] - notePosition[8] + tonic)));
    console.log(notes);
    console.log("Number of Notes: " + notes.length);

    //play the cadence
    if (!DEBUG) {
      playCadence();
      setTimeout(function () {
        startSong();
        myAniReq = window.requestAnimationFrame(drawGame);
        $stopgame.prop("disabled", false);
      }, 5000);
    } else {
      startSong();
      myAniReq = window.requestAnimationFrame(drawGame);
      $stopgame.prop("disabled", false);
    }
  }
}

function getMelody(level) {
  //for predefined levels
  notes = [];
  switch (level) {
    case 1: //start tonic, single steps, tonic to tonic+8
      notes = [8, 9, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9, 8];
      break;
    case 2: //start tonic, single steps, tonic to tonic-8
      notes = [8, 7, 6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6, 7, 8];
      break;
    case 3:
      notes = [8, 9, 10, 11, 12, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 9, 10, 9, 8];
      break;
    case 4:
      notes = [8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 6, 5, 6, 7, 8, 9, 10, 9, 8, 7, 8];
      break;
    case 5:
      notes = [8, 9, 8, 7, 6, 5, 6, 7, 8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 6, 5];
      break;
    case 6:
      notes = [8, 10, 12, 15, 12, 10, 8, 9, 10, 11, 12, 11, 10, 9, 8, 12, 8];
      break;
    case 7:
      notes = [8, 5, 3, 1, 2, 3, 4, 5, 8, 7, 6, 5, 3, 1, 5, 8, 5, 6, 7, 8];
      break;
    case 8:
      notes = [1, 3, 5, 8, 10, 12, 11, 10, 9, 8, 7, 6, 5, 8, 12, 8, 5, 1, 3, 5, 8];
      break;
    case 9:
      notes = [5, 8, 10, 8, 10, 12, 15, 14, 13, 12, 8, 7, 6, 5, 8, 9, 10, 11, 12, 8];
      break;
    case 10:
      notes = [8, 11, 12, 15, 14, 13, 8, 7, 6, 5, 12, 10, 8, 5, 7, 8, 15, 14, 13, 8];
      break;
    case 11:
      notes = [8, 4, 2, 1, 3, 4, 5, 7, 8, 9, 11, 10, 8, 6, 4, 2, 1, 3, 5, 7, 8];
      break;
    case 12:
      notes = [5, 3, 8, 7, 6, 4, 2, 1, 8, 12, 15, 14, 13, 8, 1, 3, 4, 11, 9, 8];
      break;
    case 13:
      notes = [12, 9, 11, 12, 15, 8, 1, 3, 10, 5, 7, 8, 15, 12, 8, 3, 2, 1, 5, 8];
      break;
    case 14:
      notes = [8, 14, 10, 7, 2, 5, 10, 15, 13, 6, 2, 1, 6, 4, 5, 8, 11, 4, 6, 7, 8];
      break;
    case 15:
      notes = [2, 6, 3, 12, 9, 3, 5, 12, 15, 9, 3, 7, 12, 14, 15, 12, 7, 8, 14, 7, 4, 8];
      break;
  }
}

function genMelody(level) {
  //for custom levels
  notes = [];
  let nextNote = null;
  let minNote = null;
  let maxNote = null;
  let maxStep = null;
  let up = 0;
  let count = getRandomInt(1, 8);
  switch (level) {
    case 1: //start tonic, single steps, tonic to tonic+8
      nextNote = 8;
      up = 1;
      minNote = 8;
      maxNote = 15;
      maxStep = 1;
      break;
    case 2: //start tonic, single steps, tonic to tonic-8
      nextNote = 8;
      up = 0;
      minNote = 1;
      maxNote = 8;
      maxStep = 1;
      break;
    case 3: //start tonic, single steps, tonic-3 to tonic+4
      nextNote = 8;
      up = getRandomInt(0, 1);
      minNote = 5;
      maxNote = 12;
      maxStep = 1;
      count = getRandomInt(1, 5);
      break;
  }

  for (let i = 0; i < numNotes; i++) {
    notes.push(nextNote);
    if (up == 1) {
      nextNote = Math.min(maxNote, nextNote + getRandomInt(1, maxStep));
      count--;
      if (nextNote == maxNote || count < 1) {
        count = getRandomInt(1, 5);
        up = false;
      }
    } else {
      nextNote = Math.max(minNote, nextNote - getRandomInt(1, maxStep));
      count--;
      if (nextNote == minNote || count < 1) {
        count = getRandomInt(1, 5);
        up = true;
      }
    }
  }
  function getRandomInt(min, max) {
    //inclusive of min and max
    return Math.floor(Math.random() * (max + 1 - min) + min);
  }
}

function playCadence() {
  //play the cadance
  playNote(tonic);
  playNote(tonic + 4);
  playNote(tonic + 7);
  setTimeout(function () {
    playNote(tonic);
    playNote(tonic + 5);
    playNote(tonic + 9);
  }, 1000);
  setTimeout(function () {
    playNote(tonic - 1);
    playNote(tonic + 2);
    playNote(tonic + 7);
  }, 2000);
  setTimeout(function () {
    playNote(tonic);
    playNote(tonic + 4);
    playNote(tonic + 7);
  }, 3000);
  setTimeout(function () {
    playNote(tonic);
  }, 4000);
}

function playNote(noteNum) {
  let noteName = noteStrings[noteNum % 12];
  let noteNumber = Math.floor(noteNum / 12) - 1;
  piano.play(noteName, noteNumber, 2);
}

function drawStaff() {
  staffCanvas.clearRect(0, 0, canvasWidth, canvasHeight);
  const numbers = ["1", " ", "2", " ", "3", "4", " ", "5", " ", "6", " ", "7"];
  const rows = 25;
  for (let i = 0; i < rows; i++) {
    staffCanvas.fillStyle = staffColors[i % 12];
    staffCanvas.globalAlpha = 0.4;
    staffCanvas.fillRect(0, (rows - i - 1) * rowHeight, canvasWidth, rowHeight);
    staffCanvas.fillStyle = "black";
    staffCanvas.font = "18px Arial";
    staffCanvas.globalAlpha = 1;
    staffCanvas.fillText(numbers[i % 12], 10, (rows - i) * rowHeight - 4);
  }
  staffCanvas.globalAlpha = 1;
  staffCanvas.fillStyle = "black";
  staffCanvas.lineWidth = 2;
  staffCanvas.beginPath();
  staffCanvas.moveTo(canvasLeftMargin, 0);
  staffCanvas.lineTo(canvasLeftMargin, canvasHeight);

  staffCanvas.stroke();
}

function drawGame() {
  renderFrame();
  updatePitch();
  myAniReq = window.requestAnimationFrame(drawGame);
}

function updatePitch() {
  const array32 = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(array32);

  var pitch = detectPitch(array32);

  if (pitch == null) {
    pitchFound--; //subtract one from pitchFound counter
    if (pitchFound < 1) {
      pitchArray = []; //reset the pitchArray when pitchFound = 0
    }
  } else {
    pitchFound = pitchFoundThresh; //reset counter when pitch is found
    let x = noteNumFromPitch(pitch);
    pitchArray.push(x);
    if (pitchArray.length > pitchAvgLength) {
      pitchArray.shift();
    }
  }
}

function noteNumFromPitch(frequency) {
  // C4 = 60 A3 = 57
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return noteNum + 69;
}

function noteNameFromNum(noteNum) {
  let noteName = noteStrings[noteNum % 12];
  let noteNumber = Math.floor(noteNum / 12) - 1;
  return noteName + noteNumber;
}

function frequencyFromNoteNumber(noteNum) {
  return 440 * Math.pow(2, (note - 69) / 12);
}
