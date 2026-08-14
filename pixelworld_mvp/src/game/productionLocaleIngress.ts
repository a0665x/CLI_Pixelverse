import { localeMessage, type VillageLocale } from '../i18n/villageLocale';

interface LocaleWorld { setLocale(locale: VillageLocale): void }

interface LocaleHost {
  location: { origin: string };
  parent: { postMessage(message: unknown, targetOrigin: string): void };
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export interface ProductionLocaleIngress {
  attachWorld(world: LocaleWorld): void;
  destroy(): void;
}

export function connectProductionLocaleIngress(
  host: LocaleHost = window,
): ProductionLocaleIngress {
  let selectedLocale: VillageLocale = 'zh-TW';
  let selectedSequence = Number.NEGATIVE_INFINITY;
  let world: LocaleWorld | undefined;
  const onMessage = (event: MessageEvent): void => {
    if (event.origin !== host.location.origin || event.source !== host.parent as unknown as MessageEventSource) return;
    const message = localeMessage(event.data);
    if (!message || message.sequence < selectedSequence) return;
    selectedLocale = message.locale;
    selectedSequence = message.sequence;
    world?.setLocale(selectedLocale);
  };
  host.addEventListener('message', onMessage);
  host.parent.postMessage({ type: 'pixelverse.world.ready' }, host.location.origin);
  return {
    attachWorld(nextWorld) {
      world = nextWorld;
      world.setLocale(selectedLocale);
    },
    destroy() { host.removeEventListener('message', onMessage); },
  };
}
