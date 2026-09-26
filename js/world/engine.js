import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

// 鏡頭規格：俯角 18°、偏航 0°、翻滾 0°、FOV 32°
export const CAMERA_PITCH_DEG = 18;
export const CAMERA_FOV = 32;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.55 }, warmth: { value: 0.035 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform float warmth; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb += vec3(warmth, warmth*0.4, -warmth*0.6);
      vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * vignette;
      c.rgb *= clamp(v, 0.0, 1.0);
      gl_FragColor = c;
    }`,
};

export class Engine {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.5, 200);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(-THREE.MathUtils.degToRad(CAMERA_PITCH_DEG), 0, 0);
    this.distance = 19;
    this.target = new THREE.Vector3();

    this.scene = new THREE.Scene();
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    // 移軸景深（HD-2D 招牌效果）
    this.tiltH = new ShaderPass(HorizontalTiltShiftShader);
    this.tiltV = new ShaderPass(VerticalTiltShiftShader);
    this.tiltH.uniforms.r.value = this.tiltV.uniforms.r.value = 0.5;
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    // 輕度景深：只有畫面上下邊緣略為模糊
    this.tiltStrength = 1.2;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setScene(scene) {
    this.scene = scene;
    this.renderPass.scene = scene;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.tiltH.uniforms.h.value = this.tiltStrength / w;
    this.tiltV.uniforms.v.value = this.tiltStrength / h;
  }

  // 鏡頭跟隨：固定俯角與偏航，只平移
  lookAt(target, snap = false) {
    const k = snap ? 1 : 0.12;
    this.target.lerp(target, k);
    const p = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
    this.camera.position.set(
      this.target.x,
      this.target.y + Math.sin(p) * this.distance,
      this.target.z + Math.cos(p) * this.distance,
    );
  }

  render() { this.composer.render(); }
}
