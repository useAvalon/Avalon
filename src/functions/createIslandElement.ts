export const createIslandElement = (
	id: string,
	conditionAttr: string,
	content: string,
	scriptContent: string
): string => `
    <is-land ${conditionAttr}>
      <div id="${id}">${content}</div>
      <template data-island>
        <script async type="module">
          ${scriptContent}
        </script>
      </template>
    </is-land>
  `;

export const createCleanupObserver = (container: string, cleanup: string): string => `
   const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === ${container} || node.contains(${container})) {
          ${cleanup}
          observer.disconnect();
        }
      });
    });
  });

  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
`;
