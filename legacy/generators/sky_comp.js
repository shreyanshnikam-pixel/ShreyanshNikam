class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ch: -1, sound: false, status: 'Loading the airfield' };
    this.canvasRef = (el) => { if (el && el !== this.cv) { this.cv = el; this.tryStart(); } };
    this.filmRef = (el) => { if (el && el !== this.filmEl) { this.filmEl = el; this.tryStart(); } };
    this.barRef = (el) => { this.bar = el; };
    this.subRef = (el) => { this.subEl = el; };
    this.toggleSound = () => { const on = !this.state.sound; this.setState({ sound: on }); if (this.film) this.film.setSound(on); };
    this.titleRef = (el) => { this.titleEl = el; };
  }
  tryStart() {
    if (!this.cv || !this.filmEl || this.started) return; this.started = true; this.ensureGlobal();
    this.onScroll = () => {
      const r = this.filmEl.getBoundingClientRect(), p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - window.innerHeight)));
      if (this.film) this.film.setProgress(p);
      if (this.bar) this.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.load3D().then(() => this.loadJS('assets/sky-film.js')).then(() => {
      if (this.dead) return;
      this.film = new window.SkyFilm(this.cv, { base: 'assets/', urls: { core: '/_blob/950a8875cdb8f8532999615fb9d268ec', audio: '/_blob/2dae71b84d1ec9dc2c0c2ce00592ff4d' }, sub: this.subEl, title: this.titleEl, onStatus: (s) => this.setState({ status: s }) });
      this.onScroll();
    }).catch(() => this.setState({ status: 'This film needs WebGL. Scroll on to read about Sky Sentry.' }));
  }
  componentWillUnmount() {
    this.dead = true;
    if (this.onScroll) window.removeEventListener('scroll', this.onScroll);
    if (this.film) this.film.dispose();
    (this._m3d || []).forEach((m) => m.dispose());
    this.cleanupFly();
  }
  renderVals() {
    const v = { toggleSound: this.toggleSound, soundLabel: this.state.sound ? 'Sound on' : 'Turn on sound', soundPressed: this.state.sound ? 'true' : 'false', subRef: this.subRef, titleRef: this.titleRef, canvasRef: this.canvasRef, filmRef: this.filmRef, barRef: this.barRef, 
      flyRef: this.flyRef, tiltRef: this.tiltRef, soundLabel: this.state.sound ? 'Sound on' : 'Sound off', soundPressed: this.state.sound ? 'true' : 'false',
      status: this.state.status, statusOn: this.state.status ? 'on' : '' };
    for (let i = 0; i < 6; i++) { v['c' + i] = this.state.ch === i ? 'on' : ''; v['h' + i] = this.state.ch === i ? 'false' : 'true'; }
    return v;
  }
}
