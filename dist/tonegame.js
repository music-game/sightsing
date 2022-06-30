/// <reference path="../typings/globals/jquery/index.d.ts" />

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var $debugcanvas = null;
var staffCanvas, gameCanvas, $noteElem, $numElem;
var pitchArray = new Array(384).fill(250);

$(document).ready(function () {
  let $staff = $("#staff");
  staffCanvas = $staff[0].getContext("2d");
  let $game = $("#game");
  gameCanvas = $game[0].getContext("2d");
  gameCanvas.strokeStyle = "black";
  gameCanvas.lineWidth = 5;
  drawCanvas();
  $noteElem = $("#note");
  $numElem = $("#number");
  drawStaff();
});

function drawStaff() {
  staffCanvas.clearRect(0, 0, 800, 500);
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
    staffCanvas.fillRect(0, (rows - i - 1) * rowHeight, 800, rowHeight);
    staffCanvas.fillStyle = "black";
    staffCanvas.font = "18px Arial";
    staffCanvas.globalAlpha = 1;
    staffCanvas.fillText(numbers[i % 12], 10, (rows - i) * rowHeight - 4);
  }
  staffCanvas.globalAlpha = 1;
  staffCanvas.fillStyle = "black";
  staffCanvas.moveTo(200, 0);
  staffCanvas.lineTo(200, 500);

  staffCanvas.stroke();
}

function drawCanvas() {
  gameCanvas.clearRect(0, 0, 800, 500);
  gameCanvas.strokeStyle = "black";
  gameCanvas.beginPath();
  gameCanvas.moveTo(0, pitchArray[0]);
  for (var i = 1; i < pitchArray.length; i++) {
    gameCanvas.lineTo(i, pitchArray[i]);
  }
  gameCanvas.stroke();
}

var rafID = null;

var MIN_SAMPLES = 0; // will be initialized when AudioContext is created.

function updatePitch(time) {
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
    pitchArray.push(noteScaled);
    pitchArray.shift();
    drawCanvas();
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = window.webkitRequestAnimationFrame;
  rafID = window.requestAnimationFrame(updatePitch);
}

// C4 = 60 A3 = 57
function noteNumFromPitch(frequency) {
  var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return noteNum + 69;
}
