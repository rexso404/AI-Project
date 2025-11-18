import './style.css'

let glContext = null;
let shaderProgram = null;
let aspectRatioLocation = null;
let resizeHandler = null;
let activeMode = null;

function initWebGL() {
  const canvas = document.getElementById('LEADERS');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (!gl) {
    alert('WebGL tidak didukung oleh browser Anda!');
    return null;
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return gl;
}

const vertexShaderSource = `
  attribute vec2 a_position;
  uniform float u_aspectRatio;
  varying vec2 v_position;
  void main() {
    v_position = a_position;
    vec2 position = a_position;
    position.x /= u_aspectRatio;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  void main() {
    gl_FragColor = vec4(0.95, 0.82, 0.0, 1.0);
  }
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Error linking program:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function drawHexagon(gl, program) {
  const radius = 0.6;
  const vertices = [];
  
  const centerX = 0.0;
  const centerY = 0.0;
  
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + (Math.PI / 2);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    vertices.push(x, y);
  }

  const verticesArray = new Float32Array(vertices);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, verticesArray, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLE_FAN, 0, 6);
}

function refreshBoard() {
  if (!glContext || !shaderProgram || !aspectRatioLocation) return;

  const canvas = document.getElementById('LEADERS');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  glContext.viewport(0, 0, canvas.width, canvas.height);
  const aspectRatio = canvas.width / canvas.height;
  glContext.uniform1f(aspectRatioLocation, aspectRatio);
  glContext.clear(glContext.COLOR_BUFFER_BIT);
  drawHexagon(glContext, shaderProgram);
}

function prepareBoard() {
  if (glContext) {
    refreshBoard();
    return;
  }

  glContext = initWebGL();
  if (!glContext) return;

  const vertexShader = createShader(glContext, glContext.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(glContext, glContext.FRAGMENT_SHADER, fragmentShaderSource);

  shaderProgram = createProgram(glContext, vertexShader, fragmentShader);
  if (!shaderProgram) return;

  glContext.useProgram(shaderProgram);
  aspectRatioLocation = glContext.getUniformLocation(shaderProgram, 'u_aspectRatio');

  refreshBoard();

  resizeHandler = () => refreshBoard();
  window.addEventListener('resize', resizeHandler);
}

function toggleMenu(isVisible) {
  const menu = document.getElementById('main-menu');
  const canvas = document.getElementById('LEADERS');

  if (isVisible) {
    menu.classList.remove('is-hidden');
    canvas.classList.add('canvas-hidden');
  } else {
    menu.classList.add('is-hidden');
    canvas.classList.remove('canvas-hidden');
  }
}

function startGame(mode) {
  activeMode = mode;
  toggleMenu(false);
  prepareBoard();

  const humanReadable = mode === 'ai' ? 'Versus AI' : 'Versus Player (Local)';
  console.info(`Leaders started in ${humanReadable} mode.`);
}

function wireMenuButtons() {
  const menu = document.getElementById('main-menu');
  if (!menu) return;

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]');
    if (!button) return;
    const { mode } = button.dataset;
    if (!mode) return;
    startGame(mode);
  });
}

function init() {
  wireMenuButtons();
}

document.addEventListener('DOMContentLoaded', init);
