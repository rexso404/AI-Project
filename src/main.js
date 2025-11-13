import './style.css'

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

function main() {
  const gl = initWebGL();
  if (!gl) return;

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  const program = createProgram(gl, vertexShader, fragmentShader);
  gl.useProgram(program);

  const aspectRatioLocation = gl.getUniformLocation(program, 'u_aspectRatio');
  const aspectRatio = gl.canvas.width / gl.canvas.height;
  gl.uniform1f(aspectRatioLocation, aspectRatio);

  drawHexagon(gl, program);

  window.addEventListener('resize', () => {
    const canvas = document.getElementById('LEADERS');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    const aspectRatio = canvas.width / canvas.height;
    gl.uniform1f(aspectRatioLocation, aspectRatio);

    gl.clear(gl.COLOR_BUFFER_BIT);
    drawHexagon(gl, program);
  });
}

main();
