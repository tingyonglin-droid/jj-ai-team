type Listener = (event: TestEvent) => void;

export class TestEvent {
  readonly type: string;
  readonly bubbles: boolean;
  target: TestNode | null = null;
  currentTarget: TestNode | null = null;
  defaultPrevented = false;
  cancelBubble = false;

  constructor(type: string, init: { bubbles?: boolean } = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.cancelBubble = true;
  }
}

export class TestMouseEvent extends TestEvent {}

export class TestNode {
  parentNode: TestNode | null = null;
  childNodes: TestNode[] = [];
  ownerDocument: TestDocument;
  readonly nodeType: number;
  readonly nodeName: string;
  private listeners = new Map<string, Set<Listener>>();

  constructor(ownerDocument: TestDocument, nodeType: number, nodeName: string) {
    this.ownerDocument = ownerDocument;
    this.nodeType = nodeType;
    this.nodeName = nodeName;
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get nextSibling(): TestNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes = value === "" ? [] : [this.ownerDocument.createTextNode(value)];
    for (const child of this.childNodes) child.parentNode = this;
  }

  appendChild<T extends TestNode>(child: T): T {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore<T extends TestNode>(child: T, before: TestNode | null): T {
    if (before === null) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = this.childNodes.indexOf(before);
    if (index === -1) throw new Error("Reference node is not a child");
    child.parentNode = this;
    this.childNodes.splice(index, 0, child);
    return child;
  }

  removeChild<T extends TestNode>(child: T): T {
    const index = this.childNodes.indexOf(child);
    if (index === -1) throw new Error("Node is not a child");
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: TestEvent): boolean {
    event.target ??= this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    if (event.bubbles && !event.cancelBubble) this.parentNode?.dispatchEvent(event);
    return !event.defaultPrevented;
  }
}

export class TestText extends TestNode {
  data: string;

  constructor(ownerDocument: TestDocument, data: string) {
    super(ownerDocument, 3, "#text");
    this.data = data;
  }

  override get textContent() {
    return this.data;
  }

  override set textContent(value: string) {
    this.data = value;
  }

  get nodeValue() {
    return this.data;
  }

  set nodeValue(value: string) {
    this.data = value;
  }
}

export class TestElement extends TestNode {
  readonly tagName: string;
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  readonly style: Record<string, string> = {};
  private attributes = new Map<string, string>();

  constructor(ownerDocument: TestDocument, tagName: string) {
    const normalized = tagName.toUpperCase();
    super(ownerDocument, 1, normalized);
    this.tagName = normalized;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  queryByTag(tagName: string): TestElement | null {
    const normalized = tagName.toUpperCase();
    if (this.tagName === normalized) return this;
    for (const child of this.childNodes) {
      if (child instanceof TestElement) {
        const match = child.queryByTag(normalized);
        if (match) return match;
      }
    }
    return null;
  }
}

export class TestDocument extends TestNode {
  readonly defaultView: Record<string, unknown>;
  readonly documentElement: TestElement;
  readonly body: TestElement;
  activeElement: TestElement | null = null;

  constructor() {
    super(undefined as unknown as TestDocument, 9, "#document");
    this.ownerDocument = this;
    this.defaultView = {};
    this.documentElement = this.createElement("html");
    this.body = this.createElement("body");
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
  }

  createElement(tagName: string) {
    return new TestElement(this, tagName);
  }

  createElementNS(_namespace: string, tagName: string) {
    return this.createElement(tagName);
  }

  createTextNode(data: string) {
    return new TestText(this, data);
  }

  getElementById(id: string): TestElement | null {
    const visit = (node: TestNode): TestElement | null => {
      if (node instanceof TestElement && node.getAttribute("id") === id) return node;
      for (const child of node.childNodes) {
        const match = visit(child);
        if (match) return match;
      }
      return null;
    };
    return visit(this);
  }
}

export function installTestDom() {
  const original = new Map<string, PropertyDescriptor | undefined>();
  const document = new TestDocument();
  const window = document.defaultView as Record<string, unknown>;
  Object.assign(window, {
    document,
    Node: TestNode,
    Element: TestElement,
    HTMLElement: TestElement,
    HTMLIFrameElement: class extends TestElement {},
    Event: TestEvent,
    MouseEvent: TestMouseEvent,
  });

  const globals: Record<string, unknown> = {
    document,
    window,
    Node: TestNode,
    Element: TestElement,
    HTMLElement: TestElement,
    HTMLIFrameElement: window.HTMLIFrameElement,
    Event: TestEvent,
    MouseEvent: TestMouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  };

  for (const [key, value] of Object.entries(globals)) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  return {
    document,
    restore() {
      for (const [key, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
