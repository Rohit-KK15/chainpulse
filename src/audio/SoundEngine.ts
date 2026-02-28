const CHAIN_PITCHES: Record<string, number> = {
  ethereum: 220,   // A3
  polygon: 330,    // E4
  arbitrum: 440,   // A4
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private _enabled = false;

  get enabled(): boolean {
    return this._enabled;
  }

  enable(): void {
    if (this._enabled) return;
    this._enabled = true;
    this.initContext();
    this.startAmbient();
  }

  disable(): void {
    this._enabled = false;
    this.stopAmbient();
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.1);
    }
  }

  private initContext(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.15;
    this.masterGain.connect(this.ctx.destination);
  }

  private startAmbient(): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ambientOsc) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.03;
    this.ambientGain.connect(this.masterGain);

    this.ambientOsc = this.ctx.createOscillator();
    this.ambientOsc.type = 'sine';
    this.ambientOsc.frequency.value = 55; // Sub-bass A1
    this.ambientOsc.connect(this.ambientGain);
    this.ambientOsc.start();
  }

  private stopAmbient(): void {
    if (this.ambientOsc) {
      try { this.ambientOsc.stop(); } catch { /* already stopped */ }
      this.ambientOsc = null;
    }
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
  }

  playTxPing(value: number, chainId: string): void {
    if (!this._enabled || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const basePitch = CHAIN_PITCHES[chainId] ?? 330;
    // Higher value = lower pitch (inverse relationship)
    const freq = basePitch * (1 + (1 - Math.min(value / 10, 1)) * 0.5);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playWhaleAlert(): void {
    if (!this._enabled || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // Deep resonant tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 1.5);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  playBlockChime(): void {
    if (!this._enabled || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.3);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  updateAmbient(activityLevel: number): void {
    if (!this._enabled || !this.ambientGain || !this.ambientOsc || !this.ctx) return;

    // Modulate ambient based on activity: louder + higher when busy
    const vol = 0.02 + Math.min(activityLevel, 3) * 0.015;
    const freq = 55 + Math.min(activityLevel, 3) * 10;

    this.ambientGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
    this.ambientOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.5);
  }
}

export const soundEngine = new SoundEngine();
