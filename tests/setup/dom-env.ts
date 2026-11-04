// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';

type Listener = (event: any) => void;

export class MockClassList {
  private readonly classes = new Set<string>();
  constructor(initial: string = '') {
    initial
      .split(/\s+/)
      .filter(Boolean)
      .forEach((c) => this.classes.add(c));
  }
  public add(...tokens: string[]): void {
    tokens.forEach((t) => {
      if (t) this.classes.add(t);
    });
  }
  public remove(...tokens: string[]): void {
    tokens.forEach((t) => this.classes.delete(t));
  }
  public contains(token: string): boolean {
    return this.classes.has(token);
  }
  public toggle(token: string, force?: boolean): boolean {
    const shouldHave = force !== undefined ? force : !this.classes.has(token);
    if (shouldHave) {
      this.classes.add(token);
    } else {
      this.classes.delete(token);
    }
    return shouldHave;
  }
  public toString(): string {
    return Array.from(this.classes).join(' ');
  }
}

export class MockElement {
  public tagName: string;
  public id: string = '';
  public type: string = '';
  public value: string = '';
  public src: string = '';
  public alt: string = '';
  public title: string = '';
  public textContent: string = '';
  public width: number = 512;
  public height: number = 512;
  public clientWidth: number = 1280;
  public clientHeight: number = 800;
  public offsetLeft: number = 0;
  public offsetWidth: number = 96;
  public scrollLeft: number = 0;
  public isContentEditable = false;
  public parentElement: MockElement | null = null;
  public children: MockElement[] = [];
  public dataset: Record<string, string> = {};
  public style: Record<string, any> = {
    setProperty: (k: string, v: string) => {
      this.style[k] = v;
    },
  };
  public classList: MockClassList;
  private _innerHTML = '';
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly docRef: MockDocument;
  public readonly ownerDocument: MockDocument;

  constructor(tagName: string, docRef: MockDocument, classAttr: string = '') {
    this.tagName = tagName.toUpperCase();
    this.docRef = docRef;
    this.ownerDocument = docRef;
    this.classList = new MockClassList(classAttr);
  }

  public getRootNode(): MockDocument {
    return this.docRef;
  }

  public setPointerCapture(): void {}
  public releasePointerCapture(): void {}

  public get className(): string {
    return this.classList.toString();
  }

  public set className(val: string) {
    this.classList = new MockClassList(val);
  }

  public get innerHTML(): string {
    return this._innerHTML;
  }

  public set innerHTML(html: string) {
    this._innerHTML = html;
    this.textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    this.children = [];

    // Parsăm sub-elementele principale (ex: butoanele/opțiunile create prin innerHTML)
    const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(html)) !== null) {
      const childTag = match[1];
      const attrStr = match[2] || '';
      const inner = match[3] || '';
      const child = new MockElement(childTag, this.docRef);
      child.parseAttributes(attrStr);
      child.textContent = inner.replace(/<[^>]+>/g, '').trim();
      this.appendChild(child);
    }
  }

  public parseAttributes(attrStr: string): void {
    const attrRegex = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(attrStr)) !== null) {
      const key = m[1];
      const val = m[2];
      this.setAttribute(key, val);
    }
  }

  public setAttribute(name: string, val: string): void {
    this.attributes.set(name, val);
    if (name === 'id') {
      this.id = val;
      this.docRef.registerById(val, this);
    } else if (name === 'class') {
      this.className = val;
    } else if (name === 'value') {
      this.value = val;
    } else if (name === 'type') {
      this.type = val;
    } else if (name.startsWith('data-')) {
      const camel = name
        .slice(5)
        .replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
      this.dataset[camel] = val;
    }
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public appendChild(child: MockElement): MockElement {
    child.parentElement = this;
    child.offsetLeft = this.children.length * 110;
    this.children.push(child);
    if (child.id) {
      this.docRef.registerById(child.id, child);
    }
    return child;
  }

  public removeChild(child: MockElement): MockElement {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  public insertAdjacentElement(_position: string, element: MockElement): MockElement {
    if (this.parentElement) {
      this.parentElement.appendChild(element);
    } else {
      this.docRef.body.appendChild(element);
    }
    return element;
  }

  public addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  public removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  public dispatchEvent(event: Record<string, any>): boolean {
    const type = event.type as string;
    const payload = {
      target: this,
      currentTarget: this,
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: 640,
      clientY: 400,
      ...event,
    };
    const set = this.listeners.get(type);
    if (set) {
      for (const fn of Array.from(set)) {
        fn(payload);
      }
    }
    return true;
  }

  public click(): void {
    this.dispatchEvent({ type: 'click' });
  }

  public getBoundingClientRect(): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } {
    return {
      left: 0,
      top: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
      width: this.clientWidth,
      height: this.clientHeight,
    };
  }

  public scrollTo(options?: { left?: number; top?: number; behavior?: string } | number): void {
    if (typeof options === 'number') {
      this.scrollLeft = options;
    } else if (options && typeof options.left === 'number') {
      this.scrollLeft = options.left;
    }
  }

  public querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const visit = (el: MockElement): void => {
      if (matchesSimpleSelector(el, selector)) {
        results.push(el);
      }
      for (const ch of el.children) {
        visit(ch);
      }
    };
    for (const ch of this.children) {
      visit(ch);
    }
    return results;
  }

  public getContext(contextType: string): any {
    if (contextType === '2d') {
      return createMockCanvas2DContext(this.width, this.height);
    }
    return null;
  }

  public toDataURL(): string {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}

function matchesSimpleSelector(el: MockElement, selector: string): boolean {
  const s = selector.trim();
  if (s.startsWith('#')) {
    return el.id === s.slice(1);
  }
  if (s.startsWith('.')) {
    return el.classList.contains(s.slice(1));
  }
  const dataAttrMatch = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/.exec(s);
  if (dataAttrMatch) {
    const attrName = dataAttrMatch[1];
    const attrVal = dataAttrMatch[2];
    const actual = el.getAttribute(attrName);
    if (actual === null) return false;
    return attrVal === undefined ? true : actual === attrVal;
  }
  return el.tagName.toLowerCase() === s.toLowerCase();
}

function createMockCanvas2DContext(width: number, height: number): Record<string, any> {
  const pixelBuf = new Uint8ClampedArray(width * height * 4);
  return {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillRect: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    QuadraticCurveTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    fillText: () => {},
    strokeText: () => {},
    drawImage: () => {},
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData: (imgData: { data: Uint8ClampedArray }) => {
      if (imgData?.data && imgData.data.length <= pixelBuf.length) {
        pixelBuf.set(imgData.data);
      }
    },
  };
}

export class MockDocument {
  public readonly body: MockElement;
  public readonly documentElement: MockElement;
  public activeElement: MockElement | null = null;
  public fullscreenElement: MockElement | null = null;
  private readonly byId = new Map<string, MockElement>();
  private readonly allElements: MockElement[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor() {
    this.documentElement = new MockElement('html', this);
    this.body = new MockElement('body', this);
    this.documentElement.appendChild(this.body);
  }

  public registerById(id: string, el: MockElement): void {
    if (id) {
      this.byId.set(id, el);
    }
    if (!this.allElements.includes(el)) {
      this.allElements.push(el);
    }
  }

  public createElement(tagName: string): MockElement {
    const el = new MockElement(tagName, this);
    this.allElements.push(el);
    return el;
  }

  public createElementNS(_ns: string, tagName: string): MockElement {
    return this.createElement(tagName);
  }

  public getElementById(id: string): MockElement | null {
    return this.byId.get(id) ?? null;
  }

  public querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    const parts = selector.split(',').map((p) => p.trim());
    const matches: MockElement[] = [];
    for (const el of this.allElements) {
      if (parts.some((p) => matchesSimpleSelector(el, p))) {
        matches.push(el);
      }
    }
    return matches;
  }

  public addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  public removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  public dispatchEvent(event: Record<string, any>): boolean {
    const set = this.listeners.get(event.type);
    if (set) {
      for (const fn of Array.from(set)) {
        fn(event);
      }
    }
    return true;
  }

  public loadFromIndexHtml(htmlContent: string): void {
    const openTagRegex = /<([a-zA-Z0-9-]+)\b([^>]*)>/g;
    let m: RegExpExecArray | null;
    while ((m = openTagRegex.exec(htmlContent)) !== null) {
      const tag = m[1].toLowerCase();
      if (tag === 'html' || tag === 'head' || tag === 'body' || tag === 'meta' || tag === 'link') {
        continue;
      }
      const attrs = m[2] || '';
      if (attrs.includes('id=') || attrs.includes('class=') || attrs.includes('data-')) {
        const el = this.createElement(tag);
        el.parseAttributes(attrs);
        this.body.appendChild(el);
      }
    }
  }
}

class MockAudioParam {
  public value: number;
  constructor(initial = 0) {
    this.value = initial;
  }
  public setValueAtTime(v: number): void {
    this.value = v;
  }
  public linearRampToValueAtTime(v: number): void {
    this.value = v;
  }
  public exponentialRampToValueAtTime(v: number): void {
    this.value = v;
  }
  public setTargetAtTime(v: number): void {
    this.value = v;
  }
  public cancelScheduledValues(): void {}
}

class MockAudioNode {
  public connect(dest: any): any {
    return dest;
  }
  public disconnect(): void {}
}

export class MockAudioContext {
  public currentTime = 0;
  public sampleRate = 44100;
  public state: 'suspended' | 'running' | 'closed' = 'running';
  public destination = new MockAudioNode();

  public async resume(): Promise<void> {
    this.state = 'running';
  }
  public async suspend(): Promise<void> {
    this.state = 'suspended';
  }
  public createGain(): any {
    return Object.assign(new MockAudioNode(), { gain: new MockAudioParam(1) });
  }
  public createOscillator(): any {
    return Object.assign(new MockAudioNode(), {
      type: 'sine',
      frequency: new MockAudioParam(220),
      detune: new MockAudioParam(0),
      start: () => {},
      stop: () => {},
    });
  }
  public createBiquadFilter(): any {
    return Object.assign(new MockAudioNode(), {
      type: 'lowpass',
      frequency: new MockAudioParam(500),
      Q: new MockAudioParam(1),
    });
  }
  public createDelay(): any {
    return Object.assign(new MockAudioNode(), {
      delayTime: new MockAudioParam(0.5),
    });
  }
  public createStereoPanner(): any {
    return Object.assign(new MockAudioNode(), {
      pan: new MockAudioParam(0),
    });
  }
  public createConvolver(): any {
    return Object.assign(new MockAudioNode(), {
      buffer: null,
    });
  }
  public createBuffer(channels: number, length: number, sampleRate: number): any {
    const chanData = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: (c: number) => chanData[c],
    };
  }
  public createBufferSource(): any {
    return Object.assign(new MockAudioNode(), {
      buffer: null,
      loop: false,
      start: () => {},
      stop: () => {},
    });
  }
  public createChannelMerger(): any {
    return new MockAudioNode();
  }
  public createChannelSplitter(): any {
    return new MockAudioNode();
  }
}

/**
 * Inițializează sau resetează complet mediul DOM / WebAudio / LocalStorage / Fetch pentru teste.
 */
export function setupTestDomEnvironment(options: {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  userAgent?: string;
} = {}): { document: MockDocument; localStorage: Storage } {
  const indexHtmlPath = path.resolve(process.cwd(), 'index.html');
  const htmlContent = fs.existsSync(indexHtmlPath)
    ? fs.readFileSync(indexHtmlPath, 'utf8')
    : '';

  const doc = new MockDocument();
  doc.loadFromIndexHtml(htmlContent);

  const storageMap = new Map<string, string>();
  const localStorageMock: Storage = {
    get length() {
      return storageMap.size;
    },
    clear() {
      storageMap.clear();
    },
    getItem(key: string) {
      return storageMap.has(key) ? storageMap.get(key)! : null;
    },
    key(index: number) {
      return Array.from(storageMap.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storageMap.delete(key);
    },
    setItem(key: string, value: string) {
      storageMap.set(key, String(value));
    },
  };

  const windowListeners = new Map<string, Set<Listener>>();
  const winObj: Record<string, any> = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1.5,
    localStorage: localStorageMock,
    document: doc,
    location: {
      hostname: 'localhost',
      protocol: 'http:',
    },
    navigator: {
      userAgent: options.userAgent ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X) OrbitarTest/1.0',
      hardwareConcurrency: options.hardwareConcurrency ?? 8,
      deviceMemory: options.deviceMemory ?? 8,
    },
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    speechSynthesis: {
      speaking: false,
      cancel: () => {},
      speak: (utterance: any) => {
        if (typeof utterance?.onend === 'function') {
          utterance.onend();
        }
      },
      getVoices: () => [{ lang: 'ro-RO', name: 'Romanian Voice' }],
    },
    SpeechSynthesisUtterance: class {
      public text: string;
      public lang = 'ro-RO';
      public rate = 1;
      public pitch = 1;
      public onend: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    },
    Audio: class {
      public src: string;
      public onended: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      constructor(src = '') {
        this.src = src;
      }
      public async play(): Promise<void> {
        if (this.onended) this.onended();
      }
      public pause(): void {}
    },
    addEventListener: (type: string, fn: Listener) => {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, new Set());
      }
      windowListeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: Listener) => {
      windowListeners.get(type)?.delete(fn);
    },
    dispatchEvent: (event: Record<string, any>) => {
      const set = windowListeners.get(event.type);
      if (set) {
        for (const fn of Array.from(set)) {
          fn(event);
        }
      }
      return true;
    },
    setTimeout: ((fn: (...args: any[]) => void, ms?: number, ...args: any[]) => {
      const id = globalThis.setTimeout(fn, ms, ...args);
      (id as any)?.unref?.();
      return id;
    }) as any,
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: ((fn: (...args: any[]) => void, ms?: number, ...args: any[]) => {
      const id = globalThis.setInterval(fn, ms, ...args);
      (id as any)?.unref?.();
      return id;
    }) as any,
    clearInterval: globalThis.clearInterval.bind(globalThis),
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      const id = setTimeout(() => cb(performance.now()), 16);
      (id as any)?.unref?.();
      return id;
    },
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    print: () => {},
  };

  // Fetch local care citește direct din directorul public/ pentru ./data/solar-system-ro.json, ./data/missions-ro.json și ./data/tle-iss.json
  const localFetch = async (input: string | URL | Request): Promise<any> => {
    const urlStr = typeof input === 'string' ? input : input.toString();
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
      throw new Error(`Offline test mode: network request blocked for ${urlStr}`);
    }
    const cleanRel = urlStr.replace(/^\.?\//, '');
    const filePath = path.resolve(process.cwd(), 'public', cleanRel);
    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => '',
      };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(raw),
      text: async () => raw,
    };
  };

  Object.defineProperty(globalThis, 'window', {
    value: winObj,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: doc,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: winObj.navigator,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: localFetch,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'Audio', {
    value: winObj.Audio,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    value: winObj.SpeechSynthesisUtterance,
    configurable: true,
    writable: true,
  });

  return { document: doc, localStorage: localStorageMock };
}
