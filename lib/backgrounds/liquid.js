// Liquid: slow flowing ink in coral, indigo and teal (WebGL fragment shader).
// Heat brightens it; every answer flashes a colour from the centre. Rendered at
// half resolution and stretched, which the blur-heavy look hides.
//
// No WebGL, a shader that fails to compile or link, or a lost context all
// throw / report an error carrying `fallback: "fireflies"`, which the engine
// passes on to its caller.

const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FS = `precision mediump float;uniform vec2 r;uniform float t,h,f;uniform vec3 fc;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float ns(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);return mix(mix(hs(i),hs(i+vec2(1,0)),u.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),u.x),u.y);}
float fb(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*ns(p);p*=2.03;a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*2.3;float tt=t*.045;
vec2 q=vec2(fb(p+tt),fb(p+vec2(5.2,1.3)-tt));
vec2 w=vec2(fb(p+3.*q+vec2(1.7,9.2)+tt*1.3),fb(p+3.*q+vec2(8.3,2.8)-tt));
float n=fb(p+3.*w);
vec3 c1=vec3(.918,.341,.275),c2=vec3(.30,.22,.70),c3=vec3(.10,.50,.47);
vec3 col=mix(c2,c1,smoothstep(.35,.85,n));col=mix(col,c3,smoothstep(.5,1.,length(q)));
float m=smoothstep(.3,1.,n)*(.2+.2*h);
vec3 o=vec3(.018,.018,.024)+col*m;
float d=distance(uv,vec2(.5,.56));
o+=fc*f*exp(-d*d*7.)*.32;
o*=1.-.4*smoothstep(.35,1.1,d);
gl_FragColor=vec4(o,1.);}`;

// GRE --ok and --bad, as 0..1 RGB.
const OK_COLOR = [0.37, 0.83, 0.6];
const BAD_COLOR = [1, 0.42, 0.37];

function unavailable(reason) {
	const err = new Error(`Liquid background unavailable: ${reason}`);
	err.fallback = "fireflies";
	return err;
}

function loseContext(gl) {
	try {
		gl?.getExtension("WEBGL_lose_context")?.loseContext();
	} catch {
		/* nothing else to free */
	}
}

export default {
	kind: "gl",
	create({ canvas, env, fail }) {
		if (!canvas) throw unavailable("no canvas");
		let gl = null;
		try {
			gl = canvas.getContext("webgl", { antialias: false }) || canvas.getContext("experimental-webgl");
		} catch {
			gl = null;
		}
		if (!gl) throw unavailable("no WebGL context");

		let u;
		try {
			const shader = (type, src) => {
				const s = gl.createShader(type);
				if (!s) throw unavailable("createShader failed");
				gl.shaderSource(s, src);
				gl.compileShader(s);
				if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw unavailable("shader compile failed");
				return s;
			};
			const pr = gl.createProgram();
			if (!pr) throw unavailable("createProgram failed");
			gl.attachShader(pr, shader(gl.VERTEX_SHADER, VS));
			gl.attachShader(pr, shader(gl.FRAGMENT_SHADER, FS));
			gl.linkProgram(pr);
			if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw unavailable("program link failed");
			gl.useProgram(pr);
			const buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
			const loc = gl.getAttribLocation(pr, "p");
			if (loc < 0) throw unavailable("attribute missing");
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
			u = {
				r: gl.getUniformLocation(pr, "r"),
				t: gl.getUniformLocation(pr, "t"),
				h: gl.getUniformLocation(pr, "h"),
				f: gl.getUniformLocation(pr, "f"),
				fc: gl.getUniformLocation(pr, "fc"),
			};
		} catch (err) {
			loseContext(gl);
			throw err?.fallback ? err : unavailable(err?.message || "setup failed");
		}
		let flash = 0;
		let flashColor = [0, 0, 0];

		const onLost = (e) => {
			e.preventDefault();
			fail(unavailable("context lost"));
		};
		canvas.addEventListener("webglcontextlost", onLost);

		return {
			resize() {
				canvas.width = Math.max(1, (env.W * 0.5) | 0);
				canvas.height = Math.max(1, (env.H * 0.5) | 0);
				gl.viewport(0, 0, canvas.width, canvas.height);
			},
			draw(ts, dt, k) {
				gl.uniform2f(u.r, canvas.width, canvas.height);
				gl.uniform1f(u.t, ts / 1000);
				gl.uniform1f(u.h, env.HEAT);
				gl.uniform1f(u.f, flash);
				gl.uniform3fv(u.fc, flashColor);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
				flash *= Math.pow(0.955, k);
			},
			on(type) {
				if (type === "ok") {
					flashColor = OK_COLOR;
					flash = 0.9;
				}
				if (type === "bad") {
					flashColor = BAD_COLOR;
					flash = 0.7;
				}
				if (type === "master") {
					flashColor = OK_COLOR;
					flash = 2.2;
				}
			},
			destroy() {
				canvas.removeEventListener("webglcontextlost", onLost);
				loseContext(gl);
			},
		};
	},
};
