// Add event listeners to all sliders to update their fill effect
document.addEventListener('DOMContentLoaded', () => {
    const sliders = document.querySelectorAll('input[type="range"]');
    
    const updateSliderFill = (slider) => {
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const value = parseFloat(slider.value);
        const percentage = ((value - min) / (max - min)) * 100;
        slider.style.setProperty('--value-percent', `${percentage}%`);
    };

    sliders.forEach(slider => {
        // Initial update
        updateSliderFill(slider);
        
        // Update on input and change events
        ['input', 'change'].forEach(eventType => {
            slider.addEventListener(eventType, () => {
                updateSliderFill(slider);
            });
        });
    });
});
