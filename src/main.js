import './style.css'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  CylinderGeometry,
} from 'three'

let renderer = null
let scene = null
let camera = null
let boardGroup = null
let animationFrameId = null
let resizeHandler = null
let activeMode = null

function initThreeScene() {
  if (renderer) {
    return
  }

  const canvas = document.getElementById('LEADERS')
  if (!canvas) {
    console.error('LEADERS canvas not found in the document.')
    return
  }

  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
    })
  } catch (error) {
    console.error('Failed to initialize WebGLRenderer:', error)
    alert('WebGL tidak didukung oleh browser Anda!')
    return
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true

  scene = new Scene()
  scene.background = new Color(0x050714)

  camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.set(0, 3.8, 3.8)
  camera.lookAt(0, 0, 0)

  const ambientLight = new AmbientLight(0xffffff, 0.55)
  scene.add(ambientLight)

  const keyLight = new DirectionalLight(0xf6c343, 0.85)
  keyLight.position.set(2, 5, 3)
  scene.add(keyLight)

  const rimLight = new DirectionalLight(0x6ea8ff, 0.35)
  rimLight.position.set(-3, 2, -2)
  scene.add(rimLight)

  boardGroup = createBoardGroup()
  scene.add(boardGroup)

  resizeHandler = () => handleResize()
  window.addEventListener('resize', resizeHandler)

  startAnimationLoop()
}

function createBoardGroup() {
  const group = new Group()

  const baseGeometry = new CylinderGeometry(1.8, 1.8, 0.25, 6)
  const baseMaterial = new MeshStandardMaterial({
    color: 0xf6c343,
    roughness: 0.35,
    metalness: 0.25,
  })
  const baseMesh = new Mesh(baseGeometry, baseMaterial)
  baseMesh.castShadow = true
  baseMesh.receiveShadow = true
  group.add(baseMesh)

  const rimGeometry = new CylinderGeometry(1.95, 1.95, 0.04, 6)
  const rimMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.15,
    metalness: 0.1,
  })
  const rimMesh = new Mesh(rimGeometry, rimMaterial)
  rimMesh.position.y = 0.13
  group.add(rimMesh)

  const emblemGeometry = new CylinderGeometry(0.35, 0.35, 0.06, 32)
  const emblemMaterial = new MeshStandardMaterial({
    color: 0x1b1f3b,
    roughness: 0.2,
    metalness: 0.05,
  })
  const emblem = new Mesh(emblemGeometry, emblemMaterial)
  emblem.position.y = 0.18
  group.add(emblem)

  const outlineGeometry = new EdgesGeometry(baseGeometry)
  const outlineMaterial = new LineBasicMaterial({ color: 0x0c0f21 })
  const outline = new LineSegments(outlineGeometry, outlineMaterial)
  group.add(outline)

  group.rotation.x = -Math.PI / 6

  return group
}

function startAnimationLoop() {
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)

    if (boardGroup) {
      boardGroup.rotation.y += 0.003
      boardGroup.rotation.z += 0.001
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()
}

function handleResize() {
  if (!renderer || !camera) return

  const width = window.innerWidth
  const height = window.innerHeight

  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function ensureBoardIsReady() {
  if (!renderer) {
    initThreeScene()
    return
  }

  handleResize()
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
  ensureBoardIsReady();

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
