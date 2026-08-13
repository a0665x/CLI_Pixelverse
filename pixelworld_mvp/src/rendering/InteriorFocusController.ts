export interface InteriorFocusTarget {
  visible(): boolean;
  setVisible(visible: boolean): void;
}

export class InteriorFocusController {
  private focused = false;
  private readonly prior = new Map<InteriorFocusTarget, boolean>();

  constructor(private readonly targets: InteriorFocusTarget[] = []) {}

  register(target: InteriorFocusTarget): () => void {
    if (!this.targets.includes(target)) this.targets.push(target);
    if (this.focused && !this.prior.has(target)) {
      this.prior.set(target, target.visible());
      target.setVisible(false);
    }
    return () => {
      const index = this.targets.indexOf(target);
      if (index >= 0) this.targets.splice(index, 1);
      const visible = this.prior.get(target);
      if (visible !== undefined) target.setVisible(visible);
      this.prior.delete(target);
    };
  }

  setFocused(focused: boolean): void {
    if (this.focused === focused) return;
    this.focused = focused;
    if (focused) {
      this.targets.forEach((target) => {
        if (this.prior.has(target)) return;
        this.prior.set(target, target.visible());
        target.setVisible(false);
      });
      return;
    }
    this.prior.forEach((visible, target) => target.setVisible(visible));
    this.prior.clear();
  }

  isFocused(): boolean { return this.focused; }

  destroy(): void {
    this.setFocused(false);
    this.targets.splice(0, this.targets.length);
  }
}
