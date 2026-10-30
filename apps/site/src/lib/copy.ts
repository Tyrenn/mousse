/**
 * Copy the code next to a .copy button, and say so on the button for a moment
 */
export async function copyCode(button : HTMLElement){
	const code = button.parentElement?.querySelector('code')?.textContent;
	if(!code)
		return;

	await navigator.clipboard.writeText(code);

	button.textContent = 'Copied';
	setTimeout(() => button.textContent = 'Copy', 1500);
}
