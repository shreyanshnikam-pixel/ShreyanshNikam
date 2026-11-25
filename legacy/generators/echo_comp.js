class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ch: -1, sound: false, status: 'Loading the Hollow' };
    this.canvasRef = (el) => { if (el && el !== this.cv) { this.cv = el; this.tryStart(); } };
    this.filmRef = (el) => { if (el && el !== this.filmEl) { this.filmEl = el; this.tryStart(); } };
    this.barRef = (el) => { this.bar = el; };
    this.toggleSound = () => { const on = !this.state.sound; this.setState({ sound: on }); if (this.film) this.film.setSound(on); };
    this.doPing = () => { if (this.film) this.film.ping(false); };
  }
  tryStart() {
    if (!this.cv || !this.filmEl || this.started) return; this.started = true; this.ensureGlobal();
    this.onScroll = () => {
      const r = this.filmEl.getBoundingClientRect(), p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - window.innerHeight)));
      if (this.film) this.film.setProgress(p);
      if (this.bar) this.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.load3D().then(() => this.loadJS('assets/echo-film.js')).then(() => {
      if (this.dead) return;
      this.film = new window.EchoFilm(this.cv, { base: 'assets/', urls: { core: '/_blob/dfe2c6013c6b4f64560c5366377a2f38', scare: '/_blob/f1869feae2b1316a48aa61ca42bfef81' }, onCaption: (i) => this.setState({ ch: i }), onStatus: (s) => this.setState({ status: s }) });
      this.onScroll();
    }).catch(() => this.setState({ status: 'This film needs WebGL. Scroll on to read about Echo.' }));
  }
  componentWillUnmount() {
    this.dead = true;
    if (this.onScroll) window.removeEventListener('scroll', this.onScroll);
    if (this.film) this.film.dispose();
    (this._m3d || []).forEach((m) => m.dispose());
    this.cleanupFly();
  }
  renderVals() {
    const v = { canvasRef: this.canvasRef, filmRef: this.filmRef, barRef: this.barRef, toggleSound: this.toggleSound, doPing: this.doPing,
      flyRef: this.flyRef, tiltRef: this.tiltRef, soundLabel: this.state.sound ? 'Sound on' : 'Sound off', soundPressed: this.state.sound ? 'true' : 'false',
      status: this.state.status, statusOn: this.state.status ? 'on' : '' };
    for (let i = 0; i < 6; i++) { v['c' + i] = this.state.ch === i ? 'on' : ''; v['h' + i] = this.state.ch === i ? 'false' : 'true'; }
    return v;
  }
}
