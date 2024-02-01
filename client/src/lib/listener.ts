type GenericObject = {
  [index: string]: any;
};

export default class PropertyChangeListener {
  private listeners: any[] = [];
  private loopId?: number;

  constructor() {
    this.loopId = requestAnimationFrame(this.listenUpdate.bind(this));
    console.log(this.listeners);
  }

  listenUpdate() {
    this.listeners.forEach((listener) => {
      if (listener.obj[listener.value] !== listener.prevValue) {
        listener.callback(listener.obj[listener.value]);
        listener.prevValue = listener.obj[listener.value];
      }
    });

    this.loopId = requestAnimationFrame(this.listenUpdate.bind(this));
  }

  stopListening() {
    if (!this.loopId) return;
    window.cancelAnimationFrame(this.loopId);
  }

  addListener(
    obj: GenericObject,
    value: string,
    callback: (data: any) => void,
  ): void {
    this.listeners.push({
      obj,
      value,
      prevValue: obj[value],
      callback,
    });
  }
}
