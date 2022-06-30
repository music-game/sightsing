/// <reference path="../typings/globals/jquery/index.d.ts" />

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var $debugcanvas = null;
var staffCanvas, gameCanvas, $noteElem, $numElem, canvasWidth;
var pitchArray = [250];
var myPitch = 250;

$(document).ready(function () {
  let $staff = $("#staff");
  let $game = $("#game");
  let $container = $(".container");
  $noteElem = $("#note");
  $numElem = $("#number");

  let w = window.innerWidth;
  canvasWidth = Math.min(w - 20, 800);
  $container.width(canvasWidth);
  $staff[0].width = canvasWidth;
  $game[0].width = canvasWidth;

  gameCanvas = $game[0].getContext("2d");
  gameCanvas.strokeStyle = "black";
  gameCanvas.lineWidth = 1;
  drawGame();
  staffCanvas = $staff[0].getContext("2d");
  drawStaff();
});

function startGame() {
  window.setInterval(updatePitch, 5);
  window.setInterval(drawGame, 30);
}

function drawStaff() {
  staffCanvas.clearRect(0, 0, canvasWidth, 500);
  const colors = [
    "green",
    "gray",
    "orange",
    "gray",
    "yellow",
    "blue",
    "gray",
    "red",
    "gray",
    "indigo",
    "gray",
    "violet",
  ];
  const numbers = ["1", " ", "2", " ", "3", "4", " ", "5", " ", "6", " ", "7"];
  const rows = 25;
  const rowHeight = 20;
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
  // console.log(pitchArray);
  var total = 0;
  for (var i = 0; i < pitchArray.length; i++) {
    total += pitchArray[i];
  }
  myPitch = total / pitchArray.length;
  pitchArray = [myPitch, myPitch, myPitch, myPitch, myPitch, myPitch];
  gameCanvas.clearRect(0, 0, canvasWidth, 500);
  gameCanvas.strokeStyle = "black";
  gameCanvas.beginPath();
  gameCanvas.moveTo(100, myPitch);
  gameCanvas.lineTo(80, myPitch - 10);
  gameCanvas.lineTo(80, myPitch + 10);
  gameCanvas.fill();
  gameCanvas.stroke();
}

var rafID = null;

var MIN_SAMPLES = 0; // will be initialized when AudioContext is created.

function updatePitch() {
  ac = getPitch();
  if (ac == -1) {
    $noteElem.html("--");
  } else {
    pitch = ac;
    var note = noteFromPitch(pitch);
    let noteName = noteStrings[note % 12];
    let noteNumber = Math.floor(note / 12) - 1;
    $noteElem.html(noteName + noteNumber);

    let x = noteNumFromPitch(pitch);
    $numElem.html(note);
    // 45-57-69
    let noteScaled = 500 - (x - 45) * 20;
    let p1 = Math.min(Math.max(noteScaled, 0), 500);

    pitchArray.push(p1);
  }
}

// C4 = 60 A3 = 57
function noteNumFromPitch(frequency) {
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return noteNum + 69;
}
