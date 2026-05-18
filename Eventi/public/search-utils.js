(() => {
  function bindSearchInput(input, onQueryChange, options = {}) {
    if (!input || typeof onQueryChange !== 'function') return;

    let clearBtn = options.clearBtn;
    if (!clearBtn && typeof input.closest === 'function') {
      const wrapper = input.closest('.search-wrapper');
      clearBtn = wrapper ? wrapper.querySelector('.search-clear-btn') : null;
    }

    const updateClearButton = () => {
      if (!clearBtn) return;
      clearBtn.classList.toggle('hidden', !input.value.trim());
    };

    const handleInput = () => {
      onQueryChange(input.value);
      updateClearButton();
    };

    input.addEventListener('input', handleInput);

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        onQueryChange('');
        updateClearButton();
        input.focus();
      });
      updateClearButton();
    }
  }

  window.EventiSearch = window.EventiSearch || {};
  window.EventiSearch.bindSearchInput = bindSearchInput;
})();
