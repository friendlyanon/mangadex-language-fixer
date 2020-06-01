// ==UserScript==
// @name        MangaDex language fixer
// @namespace   intermission
// @include     https://mangadex.org/title/*
// @version     1
// @grant       none
// @run-at      document-start
// ==/UserScript==

"use strict";

const getRows = (doc = document) => doc.querySelectorAll("div.chapter-container > div.row:not(:first-of-type)");
const rm = node => node && node.parentNode.removeChild(node);

function removeNonEnglish(doc) {
  for (const row of getRows(doc)) {
    const flag = row.querySelector("div.chapter-list-flag > span");
    switch (String(flag.getAttribute("title")).trim()) {
      case "English":
      case "Japanese":
        break;
      default:
        rm(row);
    }
  }
}

async function markReadHandler({ target }) {
  const el = target.closest("span[data-id]");
  if (!el || el.title === "Mark unread") {
    return;
  }

  const { id } = el.dataset;
  if (!id) {
    return;
  }
  el.dataset.id = "";

  const url = `/ajax/actions.ajax.php?function=chapter_mark_read&id=${id}`;
  const response = await fetch(location.origin + url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    el.dataset.id = id;
    return;
  }

  el.innerHTML = `<i class="fas fa-eye fa-fw"></i>`;
  el.classList.remove("grey", "chapter_mark_read_button");
  el.classList.add("chapter_mark_unread_button");
}

let cursor = -1;
let select;
const chunks = [];
const buffer = [];

function addChunk(chunk) {
  const value = String(chunks.push(chunk));
  select.appendChild(document.createElement("option")).textContent = value;
}

function addRow(row) {
  if (buffer.push(row) < 10) {
    return false;
  }

  do addChunk(buffer.splice(0, 10));
  while (buffer.length >= 10);
  return true;
}

function render(index) {
  if (cursor === index || index < 0 || chunks.length <= index) {
    return;
  }

  for (const row of getRows()) {
    rm(row);
  }
  const fragment = new DocumentFragment();
  for (const row of chunks[index]) {
    fragment.appendChild(row);
  }
  document.querySelector("div.chapter-container").appendChild(fragment);
  select.selectedIndex = cursor = index;
}

function initPagination(root) {
  const parent = root.parentNode;
  parent.previousElementSibling.outerHTML = `<select class="form-control" style="width: -moz-fit-content; margin: 1rem auto;"></select>`;
  select = parent.previousElementSibling;
  root.innerHTML = `<li class="page-item"><a class="page-link"><span class="fas fa-angle-double-left fa-fw" title="Previous page"></span></a></li><li class="page-item"><a class="page-link"><span class="fas fa-angle-double-right fa-fw" title="Next page"></span></a></li>`;
  const { 0: first, 1: last } = root.children;
  first.addEventListener("click", () => render(cursor - 1));
  last.addEventListener("click", () => render(cursor + 1));
  select.addEventListener("change", () => render(select.selectedIndex));
}

const once = (f) => {
  let unused = true;
  return function () {
    if (unused) {
      unused = false;
      return f.apply(this, arguments);
    }
  };
};

async function main() {
  const pageItems = document.querySelectorAll("ul.pagination > li");
  if (pageItems.length <= 3) {
    return;
  }
  const { href } = pageItems[pageItems.length - 1].firstElementChild;
  initPagination(document.querySelector("ul.pagination"));

  const renderOnce = once(() => render(0));
  const target = document.querySelector("div.chapter-container");
  target.style.minHeight = "494px";
  target.addEventListener("click", markReadHandler, { passive: true });
  for (const row of getRows()) {
    addRow(row) && renderOnce();
  }

  const parser = new DOMParser();
  const { 1: template, 2: last } = href.match(/^(.+\/chapters\/)(\d+)/);
  const limit = Number(last);
  for (let i = 2; i <= limit; ++i) {
    const response = await fetch(`${template}${i}`, {
      credentials: "include",
    });
    const html = await response.text();
    const doc = parser.parseFromString(html, "text/html");
    removeNonEnglish(doc);
    for (const row of getRows(doc)) {
      addRow(row) && renderOnce();
    }
  }
  if (buffer.length) {
    addChunk(buffer);
  }
  renderOnce();
}

const test = /^(\/title\/.+?)(\/chapters\/\d+\/?)?$/.exec(location.pathname);
if (test[2]) {
  window.location = Object.assign(new URL(location.href), {
    pathname: test[1],
  });
} else if (test) {
  document.addEventListener("DOMContentLoaded", () => {
    removeNonEnglish(document);
    main().catch(console.error);
  }, { once: true });
}
