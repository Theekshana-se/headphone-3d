import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import videoSrc from './v_mp_.mp4';

gsap.registerPlugin(ScrollTrigger);

// ───────── Tweakable defaults ─────────
const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brand": "NOCTURNE",
  "product": "NOCTURNE ONE",
  "headline": "Silence.\nReimagined.",
  "subhead": "Studio-grade adaptive noise cancellation in 268 grams of machined aluminum.",
  "cta": "Pre-order — $649",
  "accent": "#E8E2D8",
  "scrollLength": 700,
  "darkStart": 0.42,
  "darkEnd": 0.55
}/*EDITMODE-END*/;

// ───────── Utilities ─────────
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;

const hexToRgb = (h) => {
  const x = h.replace('#','');
  return [parseInt(x.slice(0,2),16), parseInt(x.slice(2,4),16), parseInt(x.slice(4,6),16)];
};
const mixRgb = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
const rgbStr = ([r,g,b], a=1) => `rgba(${r},${g},${b},${a})`;

// ───────── Global scroll progress ─────────
function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? window.scrollY / max : 0);
      raf = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, []);
  return p;
}

// ───────── Theme driver (light → dark via CSS vars) ─────────
function ThemeDriver({ progress, darkStart, darkEnd, accent }) {
  useLayoutEffect(() => {
    const t = easeInOut(clamp((progress - darkStart) / (darkEnd - darkStart)));

    const lightBg = hexToRgb('#EDEAE3');
    const lightSurface = hexToRgb('#F6F4EF');
    const lightInk = hexToRgb('#0B0B0C');
    const lightMute = hexToRgb('#5B5A57');
    const lightLine = hexToRgb('#1A1A1A');

    const darkBg = hexToRgb('#070707');
    const darkSurface = hexToRgb('#0E0E0F');
    const darkInk = hexToRgb('#F2EFE9');
    const darkMute = hexToRgb('#8A8780');
    const darkLine = hexToRgb('#EAE7E0');

    const bg = mixRgb(lightBg, darkBg, t);
    const surface = mixRgb(lightSurface, darkSurface, t);
    const ink = mixRgb(lightInk, darkInk, t);
    const mute = mixRgb(lightMute, darkMute, t);
    const line = mixRgb(lightLine, darkLine, t);

    const r = document.documentElement.style;
    r.setProperty('--bg', rgbStr(bg));
    r.setProperty('--surface', rgbStr(surface));
    r.setProperty('--ink', rgbStr(ink));
    r.setProperty('--mute', rgbStr(mute));
    r.setProperty('--line', rgbStr(line));
    r.setProperty('--line-soft', rgbStr(line, 0.12));
    r.setProperty('--line-strong', rgbStr(line, 0.5));
    r.setProperty('--accent', accent);
    r.setProperty('--ink-rgb', `${ink[0]},${ink[1]},${ink[2]}`);
    r.setProperty('--bg-rgb', `${bg[0]},${bg[1]},${bg[2]}`);
    r.setProperty('--theme-t', t.toFixed(3));
  }, [progress, darkStart, darkEnd, accent]);
  return null;
}

// ───────── Ultra-Smooth Scroll-bound Video via GSAP ─────────
const SmoothScrollVideo = React.memo(function SmoothScrollVideo({ src }) {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);

  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let tl;
    let frameId;

    const onLoadedMetadata = () => {
      video.pause();
      video.currentTime = 0;

      const state = { time: 0 };
      
      tl = gsap.timeline({
        scrollTrigger: {
          trigger: document.documentElement,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.2, // Heavy lag creates massive inertia, completely eliminating stutter
        }
      });
      
      // 0 to 0.03
      tl.to({}, { duration: 0.03 }, 0);
      
      // 0.03 to 0.70: Scrub video
      tl.to(state, {
        time: video.duration || 1,
        duration: 0.67,
        ease: "none",
      }, 0.03);
      
      // Opacity fade 0.62 to 0.72 (Removes the need for React to re-render this component)
      tl.to(wrapRef.current, {
        opacity: 0,
        duration: 0.10,
        ease: "none"
      }, 0.62);

      // Decouple the DOM write into a highly optimized rAF loop
      const render = () => {
        if (video.readyState >= 2 && Math.abs(video.currentTime - state.time) > 0.01) {
           // If the browser is locked up seeking the last frame, skip this command to avoid lockups
           if (!video.seeking) {
             try {
               video.currentTime = state.time;
             } catch (e) {}
           }
        }
        frameId = requestAnimationFrame(render);
      };
      render();
    };

    if (video.readyState >= 1) {
      onLoadedMetadata();
    } else {
      video.addEventListener('loadedmetadata', onLoadedMetadata);
    }

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (tl) tl.kill();
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="scroll-video-wrap" ref={wrapRef}>
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="auto"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          inset: 0,
          filter: 'none', // Overrides styles.css! CSS filters on video cause massive CPU lag
          willChange: 'transform' // Hints the GPU to composite this layer instead of CPU repainting
        }}
      />
      <div className="scroll-video-vignette" />
    </div>
  );
});

// ───────── Top nav ─────────
const Nav = React.memo(function Nav({ brand, progress }) {
  const scrolled = progress > 0.005;
  return (
    <nav className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
      <div className="nav-inner">
        <div className="nav-brand">
          <span className="nav-mark">◐</span>
          <span>{brand}</span>
        </div>
        <ul className="nav-links">
          <li>Overview</li>
          <li>Sound</li>
          <li>Specs</li>
          <li>Support</li>
        </ul>
        <div className="nav-right">
          <button className="nav-cart">Cart · 0</button>
        </div>
      </div>
    </nav>
  );
});

// ───────── Hero overlay ─────────
const Hero = React.memo(function Hero({ headline, subhead, cta, product, progress }) {
  const fade = clamp(1 - progress / 0.08);
  const lines = headline.split('\n');
  return (
    <section className="hero" style={{ opacity: fade }}>
      <div className="hero-tag">
        <span className="dot" />
        <span>Introducing · {product}</span>
      </div>
      <h1 className="hero-headline">
        {lines.map((l, i) => (
          <span key={i} className="line" style={{ animationDelay: `${0.15 + i*0.12}s` }}>
            {l}
          </span>
        ))}
      </h1>
      <p className="hero-sub">{subhead}</p>
      <div className="hero-ctas">
        <button className="btn-primary">{cta}</button>
        <button className="btn-ghost">Watch the film →</button>
      </div>
      <div className="scroll-indicator">
        <span className="scroll-label">Scroll to explore</span>
        <span className="scroll-track"><span className="scroll-bar" /></span>
      </div>
    </section>
  );
});

// ───────── Feature cards (sticky, fade in as we scroll) ─────────
const FEATURES = [
  {
    n: '01',
    label: 'Adaptive Silence',
    title: 'Twelve microphones. One quiet room.',
    body: 'A new dual-processor architecture samples your environment 96,000 times per second, sculpting noise before it reaches you.',
    range: [0.12, 0.24],
    side: 'left'
  },
  {
    n: '02',
    label: 'Spatial Audio',
    title: 'A stage you can walk through.',
    body: 'Head-tracked 360 audio with sub-3ms latency. Mixed for cinema, tuned for the way you actually listen.',
    range: [0.24, 0.36],
    side: 'right'
  },
  {
    n: '03',
    label: 'All-Day Comfort',
    title: 'Worn for hours. Felt for none.',
    body: 'Memory-cooled ear cushions and a tension-balanced titanium band that learns the shape of your head.',
    range: [0.36, 0.48],
    side: 'left'
  },
  {
    n: '04',
    label: 'Studio DNA',
    title: 'Mastered, then unbottled.',
    body: 'Co-developed with mastering engineers at Abbey-grade studios. Reference response, free of artifacts.',
    range: [0.48, 0.60],
    side: 'right'
  }
];

const FeatureCard = React.memo(function FeatureCard({ f, progress }) {
  const [a, b] = f.range;
  const inT = clamp((progress - a) / 0.06);
  const outT = clamp((progress - (b - 0.04)) / 0.06);
  const t = easeInOut(inT) * (1 - easeInOut(outT));
  const dir = f.side === 'left' ? -1 : 1;
  return (
    <div
      className={`feature feature-${f.side}`}
      style={{
        opacity: t,
        transform: `translate3d(${(1 - t) * 24 * dir}px, ${(1 - t) * 12}px, 0)`,
        pointerEvents: t > 0.5 ? 'auto' : 'none',
      }}
    >
      <div className="feature-meta">
        <span className="feature-n">{f.n}</span>
        <span className="feature-label">{f.label}</span>
      </div>
      <h3 className="feature-title">{f.title}</h3>
      <p className="feature-body">{f.body}</p>
    </div>
  );
});

const FeaturesPin = React.memo(function FeaturesPin({ progress }) {
  return (
    <section className="features-pin" aria-hidden={progress < 0.10 || progress > 0.65}>
      {FEATURES.map(f => <FeatureCard key={f.n} f={f} progress={progress} />)}
    </section>
  );
});

// ───────── Specs bento ─────────
const SPECS = [
  { k: '40 hr', v: 'Battery, ANC on', span: 'big', sub: 'Type-C · 10 min = 8 hr' },
  { k: '268 g', v: 'Featherweight', sub: 'Aerospace-grade aluminum' },
  { k: '42 mm', v: 'Beryllium drivers', sub: '4 Hz – 40 kHz' },
  { k: 'Hi-Res', v: 'LDAC · aptX Lossless', sub: '24-bit / 96 kHz wireless' },
  { k: '12', v: 'Microphones', sub: 'Adaptive beamforming array' },
  { k: '0.3 ms', v: 'Latency', sub: 'Game Mode, head-tracked spatial' },
];

const Specs = React.memo(function Specs() {
  return (
    <section className="specs" id="specs">
      <div className="section-head">
        <span className="eyebrow">— Technical</span>
        <h2 className="section-title">Engineered without compromise.</h2>
        <p className="section-sub">Every number, measured. None of them rounded for the brochure.</p>
      </div>
      <div className="bento">
        {SPECS.map((s, i) => (
          <div key={i} className={`spec ${s.span === 'big' ? 'spec-big' : ''}`}>
            <div className="spec-k">{s.k}</div>
            <div className="spec-v">{s.v}</div>
            {s.sub && <div className="spec-sub">{s.sub}</div>}
          </div>
        ))}
        <div className="spec spec-meta">
          <div className="spec-meta-row"><span>Bluetooth</span><span>5.4 · Multipoint ×3</span></div>
          <div className="spec-meta-row"><span>Codecs</span><span>LDAC · aptX Lossless · AAC · SBC</span></div>
          <div className="spec-meta-row"><span>Charging</span><span>USB-C PD · Qi 15W</span></div>
          <div className="spec-meta-row"><span>In the box</span><span>Case · 3.5mm · USB-C · Adapter</span></div>
          <div className="spec-meta-row"><span>Warranty</span><span>2 years, worldwide</span></div>
        </div>
      </div>
    </section>
  );
});

// ───────── Pull-quote / sound section ─────────
const SoundQuote = React.memo(function SoundQuote() {
  return (
    <section className="sound-quote">
      <span className="eyebrow">— On listening</span>
      <p className="quote">
        “We didn't design headphones. We designed the <em>room</em> they replace.”
      </p>
      <div className="quote-attr">
        <span>Mira Onose</span>
        <span className="quote-dot">·</span>
        <span>Acoustic Lead, NOCTURNE</span>
      </div>
    </section>
  );
});

// ───────── Closer CTA ─────────
const Closer = React.memo(function Closer({ product, cta }) {
  return (
    <section className="closer">
      <span className="eyebrow eyebrow-dark">— Available June 2026</span>
      <h2 className="closer-headline">
        Hear<br/>
        <span className="closer-italic">everything.</span><br/>
        Hear nothing.
      </h2>
      <p className="closer-sub">Pre-orders open now. First shipment limited to 5,000 units worldwide.</p>
      <div className="closer-ctas">
        <button className="btn-primary btn-primary-dark">{cta}</button>
        <button className="btn-ghost btn-ghost-dark">Find a studio →</button>
      </div>
      <div className="closer-foot">
        <span>{product} · Obsidian</span>
        <span>$649 · Free returns · 0% APR</span>
      </div>
    </section>
  );
});

// ───────── Footer ─────────
const Footer = React.memo(function Footer({ brand }) {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-col">
          <div className="footer-brand">{brand}</div>
          <p className="footer-tag">Premium audio, engineered in Kyoto &amp; Copenhagen.</p>
        </div>
        <div className="footer-col">
          <div className="footer-label">Product</div>
          <ul><li>Headphones</li><li>Earbuds</li><li>Amplifier</li><li>Accessories</li></ul>
        </div>
        <div className="footer-col">
          <div className="footer-label">Company</div>
          <ul><li>About</li><li>Studios</li><li>Press</li><li>Careers</li></ul>
        </div>
        <div className="footer-col">
          <div className="footer-label">Support</div>
          <ul><li>Contact</li><li>Returns</li><li>Warranty</li><li>Service</li></ul>
        </div>
      </div>
      <div className="footer-legal">
        <span>© 2026 Nocturne Audio Lab</span>
        <span>Designed in California. Made in Japan.</span>
      </div>
    </footer>
  );
});

// ───────── Floating cart ─────────
const FloatingCart = React.memo(function FloatingCart({ progress, product, cta }) {
  const visible = progress > 0.18;
  return (
    <div className={`floating-cart ${visible ? 'show' : ''}`}>
      <div className="fc-thumb">
        <span>◐</span>
      </div>
      <div className="fc-text">
        <div className="fc-name">{product}</div>
        <div className="fc-meta">Obsidian · $649</div>
      </div>
      <button className="fc-btn">Add to cart</button>
    </div>
  );
});

// ───────── Tweaks panel (uses helpers from tweaks-panel.jsx) ─────────
const TweaksUI = React.memo(function TweaksUI({ tweaks, setTweak }) {
  const TP = window.TweaksPanel;
  if (!TP) return null;
  return (
    <TP title="Tweaks">
      <window.TweakSection title="Brand & copy">
        <window.TweakText label="Brand"  value={tweaks.brand}    onChange={v => setTweak('brand', v)} />
        <window.TweakText label="Product" value={tweaks.product} onChange={v => setTweak('product', v)} />
        <window.TweakText label="CTA"    value={tweaks.cta}      onChange={v => setTweak('cta', v)} />
      </window.TweakSection>
      <window.TweakSection title="Accent">
        <window.TweakColor label="Accent" value={tweaks.accent}
          options={['#E8E2D8','#C9B27E','#7A8A78','#8896A6','#B85C3A']}
          onChange={v => setTweak('accent', v)} />
      </window.TweakSection>
      <window.TweakSection title="Theme transition">
        <window.TweakSlider label="Dark starts at" min={0.2} max={0.7} step={0.01}
          value={tweaks.darkStart} onChange={v => setTweak('darkStart', v)} />
        <window.TweakSlider label="Dark ends at" min={0.3} max={0.85} step={0.01}
          value={tweaks.darkEnd} onChange={v => setTweak('darkEnd', v)} />
      </window.TweakSection>
    </TP>
  );
});

// ───────── App ─────────
export default function App() {
  const useTweaks = window.useTweaks;
  const [tweaks, setTweak] = useTweaks ? useTweaks(TWEAKS_DEFAULTS) : [TWEAKS_DEFAULTS, () => {}];
  const progress = useScrollProgress();

  return (
    <>
      <ThemeDriver progress={progress} darkStart={tweaks.darkStart} darkEnd={tweaks.darkEnd} accent={tweaks.accent} />
      
      {/* Notice progress is NO LONGER passed to SmoothScrollVideo, preventing re-renders! */}
      <SmoothScrollVideo src={videoSrc} />

      <Nav brand={tweaks.brand} progress={progress} />

      <div className="scroll-spacer" style={{ height: `${tweaks.scrollLength}vh` }}>
        <Hero headline={tweaks.headline} subhead={tweaks.subhead} cta={tweaks.cta} product={tweaks.product} progress={progress} />
        <FeaturesPin progress={progress} />
      </div>

      <SoundQuote />
      <Specs />
      <Closer product={tweaks.product} cta={tweaks.cta} />
      <Footer brand={tweaks.brand} />

      <FloatingCart progress={progress} product={tweaks.product} cta={tweaks.cta} />

      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement && !rootElement._reactRootContainer) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
