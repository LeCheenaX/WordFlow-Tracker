import { Component, setIcon, setTooltip } from 'obsidian';
import { parseWordflowQuery } from './query';
import { WordflowEmbeddedViewRenderer } from './renderer';
import type WordflowTrackerPlugin from '../main';

export function registerWordflowEmbeddedViews(plugin: WordflowTrackerPlugin): void {
    const renderer = new WordflowEmbeddedViewRenderer(plugin);

    plugin.registerMarkdownCodeBlockProcessor('wordflow', (source, el, _ctx) => {
        const component = new Component();
        component.load();
        plugin.register(() => component.unload());

        const query = parseWordflowQuery(source);
        renderer.render(el, query);
        installCopyPngButton(el, renderer, component);
    });
}

function installCopyPngButton(el: HTMLElement, renderer: WordflowEmbeddedViewRenderer, component: Component): void {
    const shell = el.querySelector<HTMLElement>('.wordflow-view-shell');
    if (!shell) return;

    const host = findCodeBlockHost(el);
    host.addClass('wordflow-codeblock-host');
    host.querySelectorAll('.wordflow-codeblock-copy-png-button').forEach(button => button.remove());

    const button = document.createElement('button');
    button.type = 'button';
    button.addClass('wordflow-codeblock-copy-png-button');
    button.addClass('edit-block-button');
    button.setAttribute('aria-label', 'Copy view as PNG');
    setIcon(button, 'image-down');
    setTooltip(button, 'Copy PNG', { placement: 'top', delay: 200 });
    button.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        void renderer.copyViewAsPng(shell);
    });

    const placeButton = () => {
        const editButton = findNativeEditButton(host, button);
        if (editButton && button.parentElement !== host) {
            host.appendChild(button);
        } else if (!editButton && !button.parentElement) {
            host.appendChild(button);
        }
    };

    placeButton();
    const observer = new MutationObserver(placeButton);
    observer.observe(host, { childList: true, subtree: true });
    component.register(() => {
        observer.disconnect();
        button.remove();
    });
}

function findNativeEditButton(host: HTMLElement, ownButton: HTMLElement): HTMLElement | null {
    const buttons = Array.from(host.querySelectorAll<HTMLElement>('.edit-block-button, button[aria-label="Edit this block"]'));
    return buttons.find(button => button !== ownButton && !button.hasClass('wordflow-codeblock-copy-png-button')) ?? null;
}

function findCodeBlockHost(el: HTMLElement): HTMLElement {
    let current: HTMLElement | null = el.parentElement;
    for (let depth = 0; current && depth < 6; depth++) {
        if (current.querySelector('.edit-block-button, button[aria-label="Edit this block"]')) return current;
        current = current.parentElement;
    }
    return el.parentElement ?? el;
}
