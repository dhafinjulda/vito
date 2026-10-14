/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
/** SDK-owned camera attribution. Local DOM only; never samples the video. */
export class CameraBrandmark {
  private readonly element: HTMLSpanElement;

  constructor(container: HTMLElement) {
    const element = document.createElement('span');
    element.className = 'vito-camera-brandmark';
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', 'Powered by Vito');
    element.setAttribute('aria-hidden', 'true');
    element.style.cssText = 'position:absolute;right:10px;bottom:10px;z-index:10;display:none;pointer-events:none;user-select:none;transform:none;';
    // Isolate lettering from consumer CSS. This is visual isolation, not a
    // security boundary: the embedding application still owns its DOM.
    const root = element.attachShadow({ mode: 'closed' });
    const wordmark = document.createElement('span');
    wordmark.textContent = 'vito';
    wordmark.style.cssText = 'display:block;padding:4px 9px 5px;border-radius:5px;background:rgba(18,25,22,.8);color:#fff;font:italic 600 16px/18px Georgia,serif;letter-spacing:-.4px;white-space:nowrap;';
    root.append(wordmark);
    container.append(element);
    this.element = element;
  }

  setVisible(visible: boolean): void {
    this.element.style.display = visible ? 'block' : 'none';
    this.element.setAttribute('aria-hidden', String(!visible));
  }

  dispose(): void { this.element.remove(); }
}
