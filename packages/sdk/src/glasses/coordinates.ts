/*
 * Copyright (c) 2026 Dhafin Julda Riyanto.
 * The contents of this file are subject to CPAL-1.0; use only in compliance
 * with LICENSE at https://github.com/dhafinjulda/vito/blob/main/LICENSE.
 * Original Code: Vito browser SDK and optional asset generator.
 * Initial Developer: Dhafin Julda Riyanto. Provided AS IS, without warranty.
 * Third-party portions retain their licenses; see THIRD_PARTY_NOTICES.md.
 */
export interface Point2 { x: number; y: number }

/** Maps an unmirrored normalized video point through object-fit: cover into CSS pixels centered at the viewport origin. */
export function mapCoverPoint(
  u: number,
  v: number,
  videoWidth: number,
  videoHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): Point2 {
  const scale = Math.max(viewportWidth / videoWidth, viewportHeight / videoHeight);
  const drawnWidth = videoWidth * scale;
  const drawnHeight = videoHeight * scale;
  return {
    x: (viewportWidth - drawnWidth) / 2 + u * drawnWidth - viewportWidth / 2,
    y: viewportHeight / 2 - ((viewportHeight - drawnHeight) / 2 + v * drawnHeight),
  };
}
