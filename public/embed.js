(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || script.dataset.misoEmbedMounted) return;

  var categoryId = script.dataset.misoCategory;
  if (!categoryId) return;
  script.dataset.misoEmbedMounted = "1";

  var base = (script.dataset.misoBase || new URL(script.src).origin).replace(
    /\/+$/,
    "",
  );
  var src = base + "/embed/" + encodeURIComponent(categoryId);

  var iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = "MISO checkout";
  iframe.loading = "lazy";
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";

  script.insertAdjacentElement("afterend", iframe);

  window.addEventListener("message", function (event) {
    if (event.origin !== base) return;
    if (event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (!data || data.type !== "miso:resize") return;
    var height = Number(data.height);
    if (height > 0) iframe.style.height = height + "px";
  });
})();
