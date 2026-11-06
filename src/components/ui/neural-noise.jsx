import React, { useEffect, useRef } from 'react'

const LIME = [200 / 255, 1, 88 / 255]

const vertexSource = `
  attribute vec2 a_position;
  varying vec2 vUv;
  void main() {
    vUv = 0.5 * (a_position + 1.0);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const fragmentSource = `
  precision mediump float;
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_ratio;
  uniform vec2 u_pointer_position;
  uniform vec3 u_color;
  uniform float u_speed;
  vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
  }
  float neuro_shape(vec2 uv, float t, float p) {
    vec2 sine_acc = vec2(0.0);
    vec2 res = vec2(0.0);
    float scale = 8.0;
    for (int j = 0; j < 15; j++) {
      uv = rotate(uv, 1.0);
      sine_acc = rotate(sine_acc, 1.0);
      vec2 layer = uv * scale + float(j) + sine_acc - t;
      sine_acc += sin(layer) + 2.4 * p;
      res += (0.5 + 0.5 * cos(layer)) / scale;
      scale *= 1.2;
    }
    return res.x + res.y;
  }
  void main() {
    vec2 uv = 0.5 * vUv;
    uv.x *= u_ratio;
    vec2 pointer = vUv - u_pointer_position;
    pointer.x *= u_ratio;
    float p = 0.5 * pow(1.0 - clamp(length(pointer), 0.0, 1.0), 2.0);
    float noise = neuro_shape(uv, u_speed * u_time, p);
    noise = 1.2 * pow(noise, 3.0);
    noise += pow(noise, 10.0);
    noise = max(0.0, noise - 0.5);
    noise *= 1.0 - length(vUv - 0.5);
    gl_FragColor = vec4(u_color * noise, noise);
  }
`

/** The supplied Neural Noise shader, scoped to its container and the app's lime palette. */
export function NeuralNoise({ color = LIME, opacity = 0.38, speed = 0.00022 }) {
  const canvasRef = useRef(null)
  const [red, green, blue] = color

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas.parentElement
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false })
    if (!gl) return undefined

    const shaders = []
    const compile = (type, source) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      shaders.push(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource)
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
    const program = vertex && fragment ? gl.createProgram() : null
    if (program) {
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
    }
    if (!program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (program) gl.deleteProgram(program)
      shaders.forEach((shader) => gl.deleteShader(shader))
      return undefined
    }

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.useProgram(program)
    const position = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const uniforms = Object.fromEntries(
      ['u_time', 'u_ratio', 'u_pointer_position', 'u_color', 'u_speed'].map((name) => [
        name,
        gl.getUniformLocation(program, name),
      ]),
    )
    gl.uniform3f(uniforms.u_color, red, green, blue)
    gl.uniform1f(uniforms.u_speed, speed)

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 }
    let frame = 0
    let previousTime = 0
    let visible = true
    let contextLost = false
    const draw = (time) => {
      pointer.x += (pointer.targetX - pointer.x) * 0.12
      pointer.y += (pointer.targetY - pointer.y) * 0.12
      gl.uniform1f(uniforms.u_time, motion.matches ? 1200 : time)
      gl.uniform2f(uniforms.u_pointer_position, pointer.x, pointer.y)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const animate = (time) => {
      if (time - previousTime >= 1000 / 30) {
        draw(time)
        previousTime = time
      }
      frame = window.requestAnimationFrame(animate)
    }
    const updateAnimation = () => {
      window.cancelAnimationFrame(frame)
      if (contextLost) return
      if (!motion.matches && visible && !document.hidden) {
        frame = window.requestAnimationFrame(animate)
      } else if (visible && !document.hidden) draw(1200)
    }
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5, 1600 / Math.max(width, 1))
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(uniforms.u_ratio, canvas.width / canvas.height)
      if (!contextLost) draw(performance.now())
    }
    const move = (event) => {
      if (motion.matches || event.pointerType === 'touch') return
      const rect = container.getBoundingClientRect()
      pointer.targetX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      pointer.targetY = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    }
    const loseContext = () => {
      contextLost = true
      window.cancelAnimationFrame(frame)
    }
    const resizeObserver = new ResizeObserver(resize)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      updateAnimation()
    })
    resizeObserver.observe(container)
    observer.observe(container)
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('visibilitychange', updateAnimation)
    motion.addEventListener('change', updateAnimation)
    canvas.addEventListener('webglcontextlost', loseContext)
    resize()
    updateAnimation()

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      observer.disconnect()
      window.removeEventListener('pointermove', move)
      document.removeEventListener('visibilitychange', updateAnimation)
      motion.removeEventListener('change', updateAnimation)
      canvas.removeEventListener('webglcontextlost', loseContext)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      shaders.forEach((shader) => gl.deleteShader(shader))
    }
  }, [red, green, blue, speed])

  return <canvas className="neural-noise" ref={canvasRef} style={{ opacity }} aria-hidden="true" />
}
