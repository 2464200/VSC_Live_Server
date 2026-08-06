(function () {
  const forms = window.USERFORM_REGISTRY || [];
  const fileName = window.location.pathname.split("/").pop() || "";
  const pageId = fileName.replace(/\.html$/i, "");
  const index = forms.findIndex((f) => f.id === pageId);

  if (index < 0) {
    return;
  }

  const form = forms[index];
  const prev = forms[index - 1] || null;
  const next = forms[index + 1] || null;

  const titleNode = document.getElementById("form-name");
  const captionNode = document.getElementById("form-caption");
  const sizeNode = document.getElementById("form-size");
  const prevNode = document.getElementById("prev-form");
  const nextNode = document.getElementById("next-form");

  if (titleNode) titleNode.textContent = form.id;
  if (captionNode) captionNode.textContent = form.caption;
  if (sizeNode) sizeNode.textContent = `${form.clientWidth} x ${form.clientHeight}`;

  if (prevNode) {
    if (prev) {
      prevNode.href = `${prev.id}.html`;
      prevNode.removeAttribute("aria-disabled");
    } else {
      prevNode.setAttribute("aria-disabled", "true");
      prevNode.classList.add("btn-secondary");
    }
  }

  if (nextNode) {
    if (next) {
      nextNode.href = `${next.id}.html`;
      nextNode.removeAttribute("aria-disabled");
    } else {
      nextNode.setAttribute("aria-disabled", "true");
      nextNode.classList.add("btn-secondary");
    }
  }
})();

