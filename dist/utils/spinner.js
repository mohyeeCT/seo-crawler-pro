const frames = ['-', '\\', '|', '/'];
export function createSpinner(initialText) {
    const state = { text: initialText, isSpinning: false };
    let frameIndex = 0;
    function render() {
        const frame = frames[frameIndex = (frameIndex + 1) % frames.length];
        process.stderr.write(`\r${frame} ${state.text}`);
    }
    return {
        start(text) {
            if (text)
                state.text = text;
            if (state.isSpinning)
                return this;
            state.isSpinning = true;
            render();
            state.intervalId = setInterval(render, 80);
            return this;
        },
        succeed(text) {
            if (text)
                state.text = text;
            if (state.intervalId)
                clearInterval(state.intervalId);
            state.isSpinning = false;
            process.stderr.write(`\r✔ ${state.text}\n`);
            return this;
        },
        warn(text) {
            if (text)
                state.text = text;
            if (state.intervalId)
                clearInterval(state.intervalId);
            state.isSpinning = false;
            process.stderr.write(`\r⚠ ${state.text}\n`);
            return this;
        },
        fail(text) {
            if (text)
                state.text = text;
            if (state.intervalId)
                clearInterval(state.intervalId);
            state.isSpinning = false;
            process.stderr.write(`\r✖ ${state.text}\n`);
            return this;
        },
        set text(value) {
            state.text = value;
        },
        get text() {
            return state.text;
        },
        set textUpdate(value) {
            state.text = value;
        }
    };
}
//# sourceMappingURL=spinner.js.map