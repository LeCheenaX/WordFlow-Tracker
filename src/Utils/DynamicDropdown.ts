/**
 * DynamicDropdown - A dropdown component with dynamic width
 * 
 * This component provides a dropdown with dynamic width based on the currently 
 * selected option's display text, instead of the fixed width that accommodates 
 * the longest option.
 * 
 * Implementation:
 * - Creates a button that displays the current selection
 * - Button width adjusts dynamically to fit the current text
 * - Clicking the button opens an Obsidian Menu with all options
 * - Provides the same API as DropdownComponent for easy replacement
 */

import { Menu } from 'obsidian';

export type DropdownAlignment = 'left' | 'right';

export class DynamicDropdown {
    private button: HTMLButtonElement;
    private container: HTMLElement;
    private options: Map<string, string>; // value -> display text
    private currentValue: string;
    private changeCallback?: (value: string) => void;
    private disabled: boolean = false;
    private alignment: DropdownAlignment;
    private isMenuOpened: boolean = false;

    constructor(containerEl: HTMLElement, alignment: DropdownAlignment = 'left') {
        this.options = new Map();
        this.currentValue = '';
        this.alignment = alignment;
        
        // Create wrapper container
        this.container = containerEl.createDiv({ cls: 'wordflow-dynamic-dropdown-container' });
        
        // Create visible button
        this.button = this.container.createEl('button', { 
            cls: 'wordflow-dynamic-dropdown-button',
            type: 'button'
        });
        
        // Setup event handlers
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Button click opens menu
        this.button.addEventListener('click', (e) => {
            if (this.disabled || this.isMenuOpened) return;
            
            e.preventDefault();
            e.stopPropagation();

            if(!this.isMenuOpened) {
                this.openMenu();
            }
        });
    }

    private updateButtonText(): void {
        const displayText = this.options.get(this.currentValue) || this.currentValue;
        this.button.setText(displayText);
    }

    private openMenu() {
        // Create and show menu
        const menu = new Menu();
        this.isMenuOpened = true;
        
        // Reset state when menu closes
        menu.onHide(() => {
            setTimeout(() => {
                this.isMenuOpened = false;
            }, 200); // should have minimum delay of 100ms, because the clicking event listener has a natural delay for rouhgly 100ms。
        });
        
        // Add all options to menu
        this.options.forEach((display, value) => {
            menu.addItem((item) => {
                item
                    .setTitle(display)
                    .setChecked(value === this.currentValue)
                    .onClick(() => {
                        this.setValue(value);
                        if (this.changeCallback) {
                            this.changeCallback(value);
                        }
                    });
            });
        });
        
        // Calculate position based on alignment
        const rect = this.button.getBoundingClientRect();
        let x: number;
        const y = rect.bottom; // Bottom edge of button
        
        if (this.alignment === 'right') {
            x = rect.right; // Right edge of button text
        } else {
            x = rect.left; // Left edge of button text
        }
        
        // Show menu at calculated position
        menu.showAtPosition({ x, y });
        
        // Add CSS class for right alignment if needed
        if (this.alignment === 'right') {
            const menuEls = document.querySelectorAll('.menu');
            const menuEl = menuEls[menuEls.length - 1] as HTMLElement;
            if (menuEl) {
                menuEl.classList.add('wordflow-dynamic-dropdown-menu-right-aligned');
            }
        }
    }

    /**
     * Add an option to the dropdown
     * @param value - The value of the option
     * @param display - The display text for the option
     * @returns this for chaining
     */
    addOption(value: string, display: string): this {
        this.options.set(value, display);
        
        // Update button text if this is the current value
        if (value === this.currentValue) {
            this.updateButtonText();
        }
        
        return this;
    }

    /**
     * Set the current value
     * @param value - The value to set
     * @returns this for chaining
     */
    setValue(value: string): this {
        this.currentValue = value;
        this.updateButtonText();
        return this;
    }

    /**
     * Get the current value
     * @returns The current value
     */
    getValue(): string {
        return this.currentValue;
    }

    /**
     * Register a callback for value changes
     * @param callback - Function to call when value changes
     * @returns this for chaining
     */
    onChange(callback: (value: string) => void): this {
        this.changeCallback = callback;
        return this;
    }

    /**
     * Disable the dropdown
     * @param disabled - Whether to disable the dropdown
     * @returns this for chaining
     */
    setDisabled(disabled: boolean): this {
        this.disabled = disabled;
        this.button.disabled = disabled;
        if (disabled) {
            this.button.addClass('is-disabled');
        } else {
            this.button.removeClass('is-disabled');
        }
        return this;
    }

    /**
     * Get the container element
     * @returns The container element
     */
    getContainerEl(): HTMLElement {
        return this.container;
    }

    /**
     * Get the button element (for custom styling)
     * @returns The button element
     */
    getButtonEl(): HTMLButtonElement {
        return this.button;
    }

    /**
     * Clear all options
     */
    clear(): void {
        this.options.clear();
        this.button.setText('');
    }
}
