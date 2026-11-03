// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * LicenseModal gestionează butonul discret `ⓘ GPLv3` și fereastra modală
 * care explică licența liberă GNU General Public License v3.0 a proiectului Orbitar.
 */
export class LicenseModal {
  constructor() {
    this.bindEvents();
  }

  private bindEvents(): void {
    const btnOpen = document.getElementById('btn-gpl-modal');
    const btnClose = document.getElementById('btn-gpl-close');
    const modalBackdrop = document.getElementById('hud-gpl-modal');

    btnOpen?.addEventListener('click', () => {
      modalBackdrop?.classList.remove('is-hidden');
    });

    btnClose?.addEventListener('click', () => {
      modalBackdrop?.classList.add('is-hidden');
    });

    modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.add('is-hidden');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modalBackdrop?.classList.add('is-hidden');
      }
    });
  }
}
