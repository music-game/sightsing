/// <reference path="../typings/globals/jquery/index.d.ts" />

const Pitchfinder = require("pitchfinder");
const { start } = require("tone");

window.AudioContext = window.AudioContext || window.webkitAudioContext;

//canvas constants
const canvasHeight = 500;
const timePerNote = 1500; //ms
const noteColors = ["green", "orange", "yellow", "blue", "red", "indigo", "violet"];
const notePosition = [0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24, 25];
const rowHeight = 20;
const noteWidth = 75;
const noteHeight = 16;

//canvas/animation variables
var staffCanvas, gameCanvas, $noteElem, $numElem, canvasWidth, dpr;
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
var pitchArray = Array(pitchAvgLength).fill(250);
var myPitch = 250;

//song variables
// var mySong = null;
var notes = [0, 8, 9, 10, 11, 12, 0, 11, 10, 9, 8, 0, 7, 6, 5, 4, 0, 5, 6, 7, 8]; //8=tonic
var tonic = 57; //A3=57
var starTime = null;
var time = null;

//Song functions
function startSong() {
  startTime = new Date().getTime();
}
function stopSong() {
  startTime = null;
  gameCanvas.clearRect(0, 0, canvasWidth, 500);
  window.cancelAnimationFrame(myAniReq);
}
function renderSong() {
  if (startTime != null) {
    //figure out time step since start of game
    time = new Date().getTime();
    let dt = time - startTime;

    //clear old canvas
    gameCanvas.clearRect(0, 0, canvasWidth, 500);

    //draw notes
    for (let i = 0; i < notes.length; i++) {
      let myNote = notes[i];
      if (myNote == 0) {
        //rest
      } else {
        let myNoteRel = ((myNote - 1) % 7) + 1;
        let myColor = noteColors[myNoteRel - 1];
        let myX = 100 + i * noteWidth - (dt / timePerNote) * noteWidth;
        let myY = canvasHeight - notePosition[myNote] * rowHeight + (rowHeight - noteHeight) / 2;
        let myWidth = noteWidth;
        let myHeight = rowHeight * 0.8;
        if (myX > -noteWidth && myX < canvasWidth) {
          gameCanvas.strokeStyle = "black";
          gameCanvas.fillStyle = myColor;
          gameCanvas.beginPath();
          gameCanvas.rect(myX, myY, myWidth, myHeight);
          gameCanvas.fill();
          gameCanvas.stroke();
          gameCanvas.fillStyle = "black";
          gameCanvas.font = "16px Arial";
          gameCanvas.fillText(myNoteRel, myX + 10, myY + 14);
        }
      }
    }
    //draw arrow
    var total = 0;
    for (var i = 0; i < pitchArray.length; i++) {
      total += pitchArray[i];
    }
    myPitch = total / pitchArray.length;
    gameCanvas.strokeStyle = "black";
    gameCanvas.fillStyle = "black";
    gameCanvas.lineWidth = 1;
    gameCanvas.beginPath();
    gameCanvas.moveTo(100, myPitch - 10);
    gameCanvas.lineTo(80, myPitch);
    gameCanvas.lineTo(80, myPitch - 20);
    gameCanvas.fill();
    gameCanvas.stroke();
  }
}

$(document).ready(function () {
  let $staff = $("#staff");
  let $game = $("#game");
  let $container = $(".container");
  $noteElem = $("#note");
  $numElem = $("#number");

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
  staffCanvas.clearRect(0, 0, canvasWidth, 500);
  const colors = ["green", "gray", "orange", "gray", "yellow", "blue", "gray", "red", "gray", "indigo", "gray", "violet"];
  const numbers = ["1", " ", "2", " ", "3", "4", " ", "5", " ", "6", " ", "7"];
  const rows = 25;
  staffCanvas.beginPath();
  for (let i = 0; i < rows; i++) {
    staffCanvas.fillStyle = colors[i % 12];
    staffCanvas.globalAlpha = 0.4;
    staffCanvas.fillRect(0, (rows - i - 1) * rowHeight, canvasWidth, rowHeight);
    staffCanvas.fillStyle = "black";
    staffCanvas.font = "18px Arial";
    staffCanvas.globalAlpha = 1;
    staffCanvas.fillText(numbers[i % 12], 10, (rows - i) * rowHeight - 4);
  }
  staffCanvas.globalAlpha = 1;
  staffCanvas.fillStyle = "black";
  staffCanvas.moveTo(100, 0);
  staffCanvas.lineTo(100, 500);

  staffCanvas.stroke();
}

function drawGame() {
  renderSong();
  updatePitch();
  myAniReq = window.requestAnimationFrame(drawGame);
}

function updatePitch() {
  const array32 = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(array32);

  var pitch = detectPitch(array32);

  if (pitch == null) {
    $noteElem.html("--");
    // console.log(null);
  } else {
    // pitch = pitch * 0.99;
    console.log(pitch);
    var note = noteFromPitch(pitch);
    let noteName = noteStrings[note % 12];
    let noteNumber = Math.floor(note / 12) - 1;
    $noteElem.html(noteName + noteNumber);

    let x = noteNumFromPitch(pitch);
    $numElem.html(note);
    // 45-57-69
    let noteScaled = 500 - (x - 45) * 20;
    let p1 = Math.min(Math.max(noteScaled, 0), 500);

    pitchArray.shift();
    pitchArray.push(p1);
  }
}

// C4 = 60 A3 = 57
function noteNumFromPitch(frequency) {
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  // console.log(noteNum + 69);
  return noteNum + 69;
}

var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromPitch(frequency) {
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}
