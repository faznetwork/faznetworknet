(function () {
    'use strict';

    function toggleSubmenu(event, button) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!button) return;

        const submenu = button.nextElementSibling;
        const isOpen = Boolean(submenu && !submenu.classList.contains('show'));
        if (submenu) submenu.classList.toggle('show', isOpen);

        button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        const arrow = button.querySelector('.arrow-icon');
        if (arrow) {
            arrow.classList.toggle('bi-chevron-up', isOpen);
            arrow.classList.toggle('bi-chevron-down', !isOpen);
        }
    }

    window.toggleSubmenu = toggleSubmenu;
})();
