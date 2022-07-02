/// <reference path="../typings/globals/jquery/index.d.ts" />

// TODO:
// Play a different cadance depending on tonic.
// Allow user to adjust tonic
// Scoring
// Finish game when done
// Drop down box for levels

const Pitchfinder = require("pitchfinder");
const { start } = require("tone");

window.AudioContext = window.AudioContext || window.webkitAudioContext;

//canvas constants
const canvasHeight = 500; //px
const canvasLeftMargin = 150; //pixels between left of canvas and time=0 line
const ppms = 0.05; //canvas pixels per ms
const timePerNote = 1000; //ms
const timePerRest = 1000; //ms
const restInterval = 4; //notes between each rest
const initialRest = 1000; //ms
const staffColors = ["LimeGreen", "gray", "salmon", "gray", "yellow", "DeepSkyBlue", "gray", "crimson", "gray", "orange", "gray", "violet"];
const noteColors = ["LimeGreen", "salmon", "yellow", "DeepSkyBlue", "crimson", "orange", "violet"];
const notePosition = [0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24, 25];
const rowHeight = 20;
const noteWidth = timePerNote * ppms;
const noteHeight = 16;

//canvas/animation variables
var staffCanvas, gameCanvas, $score, $progress, canvasWidth, dpr;
var myAniReq = null;

//variables for audiocontext and playing tones
var audioContext = null;
var stream = null;
var analyser = null;
var mediaStreamSource = null;
var detectPitch = null;
var piano = null;

//pitch variables
const pitchAvgLength = 5;
var pitchArray = Array(pitchAvgLength).fill(57.0);
var myPitch = 57.0;

//song variables
var notes = [8, 9, 10, 11, 12, 11, 10, 9, 8, 7, 6, 5, 4, 5, 6, 7, 8]; //8=tonic
var tonic = 60; //A3=57
var startTime = null;
var time = null;
var currentNote = 0;
var prevNote = 0;

//scoring variables
var noteScoreArray = [];
var currentScore = 0;
var currentProgress = 0;
const perfScoreVal = 1;

$(document).ready(function () {
  let $staff = $("#staff");
  let $game = $("#game");
  let $container = $(".container");
  $score = $(".score");
  $progress = $(".progress");

  dpr = window.devicePixelRatio || 1;
  let w = window.innerWidth;
  canvasWidth = Math.min(w - 20, 800);
  $container.width(canvasWidth);
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
  drawStaff();

  //initialize the synthesizer upon page load
  piano = Synth.createInstrument("piano");
  Synth.setSampleRate(48000); // sets sample rate [Hz]
  Synth.setVolume(0.5); // set volume [0-1]

  $(".stopgame").click(function () {
    if (stream != null) {
      stream.getAudioTracks().forEach((track) => {
        track.stop();
      });
      console.log("stopping mic");
      stream = null;
      audioContext.close();
    }
    stopSong();
  });

  $(".newgame").click(function () {
    startGame(true);
  });

  $(".startgame").click(function () {
    startGame(false);
  });
});

//Song functions
function startSong() {
  startTime = new Date().getTime();
}
function stopSong() {
  startTime = null;
  gameCanvas.clearRect(0, 0, canvasWidth, canvasHeight);
  window.cancelAnimationFrame(myAniReq);
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
    //draw arrow
    var total = 0;
    for (var i = 0; i < pitchArray.length; i++) {
      total += pitchArray[i];
    }
    myPitch = total / pitchArray.length;

    // 45-57-69
    let noteScaled = Math.min(Math.max(canvasHeight - 10 - (myPitch - tonic + 12) * rowHeight, 0), canvasHeight);

    //calculate scoring on this note so far
    let scoring = 0;
    if (noteScaled < noteCenter + 5 && noteScaled > noteCenter - 5) {
      scoring = 2;
    } else if (noteScaled < noteCenter + 10 && noteScaled > noteCenter - 10) {
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

    $score.html(Math.round(currentScore * 10) / 10 + "%");
    $progress.html(Math.round(currentProgress * 10) / 10 + "%");

    if (scoring > 0) {
      gameCanvas.strokeStyle = "black";
      gameCanvas.fillStyle = "green";
    } else {
      gameCanvas.strokeStyle = "black";
      gameCanvas.fillStyle = "black";
    }
    gameCanvas.lineWidth = 1;
    gameCanvas.beginPath();
    gameCanvas.moveTo(canvasLeftMargin, noteScaled);
    gameCanvas.lineTo(canvasLeftMargin - 20, noteScaled + 10);
    gameCanvas.lineTo(canvasLeftMargin - 20, noteScaled - 10);
    gameCanvas.lineTo(canvasLeftMargin, noteScaled);
    gameCanvas.fill();
    gameCanvas.stroke();
  }
}

async function getMedia() {
  if (stream == null) {
    try {
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

      detectPitch = Pitchfinder.AMDF({
        sampleRate: sampleRate,
        minFrequency: 78,
        maxFrequency: 1000,
        ratio: 5,
        sensitivity: 0.2,
      });
    } catch (err) {
      console.log("failed to get stream");
    }
  }
}

async function startGame(newgame) {
  stopSong();
  await getMedia(); //get the microphone working
  if (newgame) {
    //generate new melody
  }

  //play the cadance
  piano.play("A", 3, 2);
  piano.play("C#", 4, 2);
  piano.play("E", 4, 2);
  setTimeout(function () {
    piano.play("A", 3, 2);
    piano.play("D", 4, 2);
    piano.play("F#", 4, 2);
  }, 1000);
  setTimeout(function () {
    piano.play("G#", 3, 2);
    piano.play("B", 3, 2);
    piano.play("E", 4, 2);
  }, 2000);
  setTimeout(function () {
    piano.play("A", 3, 2);
    piano.play("C#", 4, 2);
    piano.play("E", 4, 2);
  }, 3000);
  setTimeout(function () {
    piano.play("A", 3, 2);
  }, 4000);
  setTimeout(function () {
    startSong();
    myAniReq = window.requestAnimationFrame(drawGame);
  }, 5000);
}

function drawStaff() {
  staffCanvas.clearRect(0, 0, canvasWidth, canvasHeight);
  const numbers = ["1", " ", "2", " ", "3", "4", " ", "5", " ", "6", " ", "7"];
  const rows = 25;
  staffCanvas.beginPath();
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
    //do nothing
  } else {
    console.log(pitch);
    // var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    // var note = Math.round(noteFromPitch(pitch));
    // let noteName = noteStrings[note % 12];
    // let noteNumber = Math.floor(note / 12) - 1;
    // $noteElem.html(noteName + noteNumber);
    // $numElem.html(note);

    let x = noteNumFromPitch(pitch);
    pitchArray.shift();
    pitchArray.push(x);
  }
}

// C4 = 60 A3 = 57
function noteNumFromPitch(frequency) {
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return noteNum + 69;
}

function frequencyFromNoteNumber(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}
