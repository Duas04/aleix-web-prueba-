(() => {
  'use strict';
  const dialog = document.querySelector('#order-dialog');
  if (!dialog) return;
  const form = document.querySelector('#order-form');
  const quantity = document.querySelector('#order-quantity');
  const catalog = Object.freeze({paperback: {name: 'Tapa blanda', cents: 1500}, hardcover: {name: 'Tapa dura', cents: 2000}});
  const money = new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR'});
  let opener;

  function updateSummary() {
    const key = form.elements.edition.value;
    const item = catalog[key];
    const units = Number(quantity.value);
    if (!item || !Number.isInteger(units) || units < 1 || units > 10) return;
    document.querySelector('#order-description').textContent = `${units} × ${item.name}`;
    document.querySelector('#order-subtotal').textContent = money.format(item.cents * units / 100);
    document.querySelector('#order-total').textContent = money.format((item.cents * units + 700) / 100);
    document.querySelector('#order-announcement').textContent = `${units} ${units === 1 ? 'ejemplar' : 'ejemplares'} de ${item.name.toLowerCase()}. Total con envío: ${money.format((item.cents * units + 700) / 100)}.`;
    const subject = `Consulta sobre Fumada XXL: ${units} × ${item.name}`;
    document.querySelector('#order-contact').href = `mailto:theshoz@gmail.com?subject=${encodeURIComponent(subject)}`;
  }

  document.querySelectorAll('[data-edition]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.edition;
      if (!catalog[key]) return;
      opener = button;
      form.elements.edition.value = key;
      quantity.value = '1';
      updateSummary();
      dialog.showModal();
    });
  });
  form.addEventListener('change', updateSummary);
  form.addEventListener('submit', event => event.preventDefault());
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener?.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
})();
