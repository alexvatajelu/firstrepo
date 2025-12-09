
//sorry this was more complex than expected
//this code is adapted from the og visualiser, but only for playback - the old code for serial input is commented out
//to change look, replace code in draw function



let config;
let serial;
let bridge;

let sampledata = `{"info":{"loop":178,"interval":0.1,"time":17.800001152},"temp":{"raw":149,"adjusted":22},"presa":{"raw":414,"adjusted":45},"presb":{"raw":306,"adjusted":43},"cond":{"raw":74,"adjusted":93,"contact":true}}`;

let savecache = {};
let structured = {};
let saving = false;     //0 - null state and download + delete cache on switch to, 1 - saving to cache

let grawpa;
let grawpb;
let grawcond;

// new vars
let fileInputEl;
let fileNameP;
let playBtn, pauseBtn;
let positionSlider;
let dataset = [];           // loaded dataset (array of samples)
let currentIndex = 0;
let playing = false;
let playStartMillis = 0;
let playStartTime = 0;

async function setup() {
    config = await loadJSON('config.json');
    if (config.main.debug){
        console.log(config);
    }

    serial = JSON.parse(sampledata);

    createCanvas(config.init.canvas_width, config.init.canvas_height);
    background(config.main.background_color);

    // UI: file input + filename
    fileInputEl = createFileInput(handleFile);
    fileInputEl.position(10, config.init.canvas_height + 10);
    fileNameP = createP('No file loaded');
    fileNameP.position(10, config.init.canvas_height + 40);

    // Playback controls
    playBtn = createButton('Play');
    playBtn.position(200, config.init.canvas_height + 10);
    playBtn.mousePressed(() => {
        if (dataset.length === 0) return;
        playing = true;
        playStartMillis = millis();
        playStartTime = dataset[currentIndex].info ? dataset[currentIndex].info.time : dataset[currentIndex].time || 0;
    });

    pauseBtn = createButton('Pause');
    pauseBtn.position(260, config.init.canvas_height + 10);
    pauseBtn.mousePressed(() => {
        playing = false;
    });

    // position slider (will be configured when dataset is loaded)
    positionSlider = createSlider(0, 100, 0);
    positionSlider.position(10, config.init.canvas_height + 80);
    positionSlider.style('width', '400px');
    positionSlider.input(() => {
        if (dataset.length === 0) return;
        // pause while scrubbing
        playing = false;
        const idx = int(positionSlider.value());
        setIndex(constrain(idx, 0, dataset.length - 1));
    });

    /*
    let rsbutton = createButton("record");
    //rsbutton.position((windowWidth - config.init.canvas_width) / 2 + 10, (windowHeight - config.init.canvas_height) / 2 + 40);
    rsbutton.position(10,10);
    rsbutton.mousePressed(recordsave);

    bridge = new SerialBridge();
    
    bridge.onData('device_1', (data) => {
        serial = JSON.parse(data);
        if (saving == 1){
            restructure();
            savecache[serial.info.loop] = structured;
        }
        if (config.main.debug){
            restructure();
            console.log('Received:', structured);
        }
    });
    */

    grawpa = new graph("presa", 0, 4095, 10, config.init.canvas_height * 0.6, config.init.canvas_width - 20, 100);
    grawpb = new graph("presb", 0, 4095, 10, config.init.canvas_height * 0.6 + 100, config.init.canvas_width - 20, 100);
    grawcond = new graph("cond", 0, 4095, 10, config.init.canvas_height * 0.6 + 200, config.init.canvas_width - 20, 100);
    
    //serial = JSON.parse(sampledata);
}
// ...existing code...

function draw() {
    background(config.main.background_color);
    noStroke();

    // playback logic
    if (dataset.length > 0 && playing) {
        const elapsed = (millis() - playStartMillis) / 1000.0;
        const targetTime = playStartTime + elapsed;
        // advance currentIndex to match targetTime
        while (currentIndex < dataset.length - 1 && (dataset[currentIndex + 1].info ? dataset[currentIndex + 1].info.time : dataset[currentIndex + 1].time) <= targetTime) {
            currentIndex++;
        }
        // if reached end, stop
        if (currentIndex >= dataset.length - 1) {
            playing = false;
        }
        setSerialFromDataset(currentIndex, false); // update serial but don't rebuild graphs fully
        positionSlider.value(currentIndex);
    }




    //put drawing code from here on in this function, you can replace everything here and use the same variables





    let condadj = int((float(serial.cond.adjusted) ** 2) / 100);
    
    fill(config.main.shape_color_2);
    //fill(9 * serial.temp.adjusted, 9 * 22 , 9 * 22 * 2 - serial.temp.adjusted * 9);
    ellipse(config.init.canvas_width / 2, config.init.canvas_height / 2 * 0.5,1.5 *  (5 * condadj + 10), (3 * condadj + 10));

    fill(config.main.shape_color_1);
    ellipse(config.init.canvas_width / 3 * 1, config.init.canvas_height / 2 * 0.5, 2 * serial.presa.adjusted + 20);
    ellipse(config.init.canvas_width / 3 * 2, config.init.canvas_height / 2 * 0.5, 2 * serial.presb.adjusted + 20);

    strokeWeight(4);
    stroke("black");
    textSize(config.main.text_size_1);
    fill(config.main.text_color_1);
    textAlign(LEFT, TOP);

    text(`time: ${round(serial.info.time*1000)/1000}`, 10, 10);

    textAlign(CENTER, CENTER);

    //text(`temp: ${serial.temp.adjusted}`, config.init.canvas_width / 2, config.init.canvas_height / 2 * 1.2);
    text(`cond: ${condadj}`, config.init.canvas_width / 2, config.init.canvas_height / 2 * 0.8);
    
    text(`presa: ${serial.presa.adjusted}`, config.init.canvas_width / 3 * 1, config.init.canvas_height / 2);
    text(`presb: ${serial.presb.adjusted}`, config.init.canvas_width / 3 * 2, config.init.canvas_height / 2);

    grawpa.addData(serial.presa.raw);
    grawpa.draw();
    grawpb.addData(serial.presb.raw);
    grawpb.draw();
    grawcond.addData(serial.cond.raw);
    grawcond.draw();
}
// ...existing code...

// helper: set serial based on dataset[index], normalize formats
function setSerialFromDataset(index, rebuildGraphs = true) {
    if (!dataset || dataset.length === 0) return;
    const rawSample = dataset[index];
    serial = normalizeSample(rawSample);

    if (rebuildGraphs) {
        // rebuild graphs history window up to current index (so graphs show past history)
        const win = int(grawpa.w);
        grawpa.data = [];
        grawpb.data = [];
        grawcond.data = [];
        const start = max(0, index - win + 1);
        for (let i = start; i <= index; i++) {
            const s = normalizeSample(dataset[i]);
            grawpa.addData(s.presa.raw);
            grawpb.addData(s.presb.raw);
            grawcond.addData(s.cond.raw);
        }
    }
}

// normalize a loaded sample into original serial structure expected by the rest of the code
function normalizeSample(s) {
    // if already in Arduino-like format (has .info and .presa)
    if (s.info && s.presa && s.presb && s.cond) {
        return s;
    }
    // if it's one of your "structured" exports (flat keys)
    // expected keys: time, pressure_a, pressure_b, conductivity, touched, raw: {pressure_a, pressure_b, conductivity}
    if (s.time !== undefined || s.pressure_a !== undefined) {
        const out = {
            info: {
                time: s.time !== undefined ? s.time : (s.info ? s.info.time : 0),
                loop: s.loop || 0,
                interval: s.interval || 0
            },
            temp: { raw: 0, adjusted: 0 },
            presa: { raw: (s.raw && s.raw.pressure_a) ? s.raw.pressure_a : (s.pressure_a || 0), adjusted: s.pressure_a || 0 },
            presb: { raw: (s.raw && s.raw.pressure_b) ? s.raw.pressure_b : (s.pressure_b || 0), adjusted: s.pressure_b || 0 },
            cond: { raw: (s.raw && s.raw.conductivity) ? s.raw.conductivity : (s.conductivity || 0), adjusted: s.conductivity || 0, contact: s.touched || false }
        };
        return out;
    }
    // fallback: try parse common shapes
    return {
        info: { time: (s.info && s.info.time) ? s.info.time : 0, loop: 0, interval: 0 },
        temp: { raw: 0, adjusted: 0 },
        presa: { raw: (s.presa && s.presa.raw) ? s.presa.raw : (s.raw && s.raw.pressure_a ? s.raw.pressure_a : 0), adjusted: (s.presa && s.presa.adjusted) ? s.presa.adjusted : (s.pressure_a || 0) },
        presb: { raw: (s.presb && s.presb.raw) ? s.presb.raw : (s.raw && s.raw.pressure_b ? s.raw.pressure_b : 0), adjusted: (s.presb && s.presb.adjusted) ? s.presb.adjusted : (s.pressure_b || 0) },
        cond: { raw: (s.cond && s.cond.raw) ? s.cond.raw : (s.raw && s.raw.conductivity ? s.raw.conductivity : 0), adjusted: (s.cond && s.cond.adjusted) ? s.cond.adjusted : (s.conductivity || 0), contact: (s.cond && s.cond.contact) ? s.cond.contact : (s.touched || false) }
    };
}


// ...existing code...
function handleFile(file) {
    if (!file) {
        fileNameP.html('No file selected');
        return;
    }

    // helper to process already-parsed JSON
    function processParsed(parsed, filename) {
        try {
            // Accept various shapes: array or object map
            if (Array.isArray(parsed)) {
                dataset = parsed;
            } else if (typeof(parsed) === 'object' && parsed !== null) {
                const vals = Object.values(parsed);
                if (vals.length > 0 && (Array.isArray(vals) || typeof(vals[0]) === 'object')) {
                    dataset = vals;
                } else {
                    dataset = [parsed];
                }
            } else {
                dataset = [parsed];
            }
            // sort by time if available
            dataset.sort((a,b) => {
                const ta = a && a.info ? a.info.time : (a && a.time || 0);
                const tb = b && b.info ? b.info.time : (b && b.time || 0);
                return ta - tb;
            });

            currentIndex = 0;
            // set slider range to dataset length
            positionSlider.attribute('min', 0);
            positionSlider.attribute('max', max(0, dataset.length - 1));
            positionSlider.value(0);

            setIndex(0);
            fileNameP.html(`${filename} ��� ${dataset.length} samples`);
            if (config.main.debug) console.log('Loaded dataset', dataset.length, 'samples');
        } catch (e) {
            fileNameP.html('Failed to process JSON: ' + e.message);
            console.error(e);
        }
    }

    // If file.data is already an object (p5 sometimes provides parsed JSON), use it directly
    if (file.data && typeof file.data === 'object') {
        processParsed(file.data, file.name || 'file');
        return;
    }

    // If file.data is a string that looks like JSON, try parse it
    if (file.data && typeof file.data === 'string' && file.data.trim() !== '[object Object]') {
        try {
            const parsed = JSON.parse(file.data);
            processParsed(parsed, file.name || 'file');
            return;
        } catch (e) {
            // fall through to try reading the raw File/Blob
            console.warn('String parse failed, will try FileReader:', e);
        }
    }

    // If there's an underlying File/Blob, read it with FileReader (handles cases where p5 gives [object Object])
    if (file.file && (file.file instanceof Blob || (typeof File !== 'undefined' && file.file instanceof File))) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = reader.result;
                const parsed = JSON.parse(text);
                processParsed(parsed, file.name || (file.file && file.file.name) || 'file');
            } catch (e) {
                fileNameP.html('Failed to parse JSON: ' + e.message);
                console.error(e);
            }
        };
        reader.onerror = () => {
            fileNameP.html('Failed to read file');
            console.error(reader.error);
        };
        reader.readAsText(file.file);
        return;
    }

    // Unknown/unsupported format
    fileNameP.html('No readable JSON data found in file');
}

function setIndex(idx) {
    currentIndex = constrain(idx, 0, max(0, dataset.length - 1));
    setSerialFromDataset(currentIndex, true);
    positionSlider.value(currentIndex);
    // pause when user explicitly sets position
    playing = false;
}
// ...existing code...
class graph {
    constructor(name, min, max, x, y, w, h) {
        this.name = name;
        this.min = min;
        this.max = max;
        this.range = max - min;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.data = [];
    }
    addData(d) {
        this.data.push(d);
        if (this.data.length > this.w) {
            this.data.splice(0, 1);
        }
    }
    draw() {
        stroke(0);
        strokeWeight(3);
        fill(config.main.graph_color_1);
        rect(this.x, this.y, this.w, this.h);
        noFill();
        strokeWeight(1);
        beginShape();
        for (let i = 0; i < this.data.length; i++) {
            let dy = map(this.data[i], this.min - this.range * 0.1, this.max + this.range * 0.1, this.h, 0);
            vertex(this.x + i, this.y + dy);
        }
        endShape();
        textAlign(RIGHT, TOP);
        noStroke();
        fill(0);
        text(`${this.name} ${this.data[this.data.length - 1]}`, this.x + this.w, this.y + 50);

    }
}

    