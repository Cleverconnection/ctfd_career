function mostrarDesafio(id) {
  // Esconde todos os iframes
  document.querySelectorAll("div[id^='iframe-']").forEach((div) => {
    div.classList.add("d-none");
  });

  // Mostra apenas o desafio selecionado
  const alvo = document.getElementById(`iframe-${id}`);
  if (alvo) {
    alvo.classList.remove("d-none");
    alvo.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Oculta mensagem inicial se presente
  const msg = document.getElementById("mensagem-inicial");
  if (msg) msg.classList.add("d-none");
}
