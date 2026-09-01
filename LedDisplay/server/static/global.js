const dispdataUrl = '/led-display/get/dispdata';
const postUrl = '/led-display/post/dispdata';
const delayUrl = '/led-display/set/delay';
const stepUrl = '/led-display/set/step';
const randomUrl = '/led-display/set/random';
const scrollUrl = '/led-display/set/scroll';

const minDelay = 20, maxDelay = 500;
const maxSpeedValue = 100;
const maxFileSize = 1024;

let speed = 50, step = 1;
let start = 0;
let intervalId;
let byteArray;