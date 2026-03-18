const fs = require('fs');

const zoneConfig = [
    { id: 1, name: "หน้าบ้าน/หน้าTV", lights: [{ id: 1, name: "หน้าบ้าน" }, { id: 2, name: "หน้าTV" }] },
    { id: 2, name: "กลางบ้าน", lights: [{ id: 1, name: "ดวงหน้า" }, { id: 2, name: "ดวงหลัง" }] },
    { id: 3, name: "ห้องน้ำ", lights: [{ id: 1, name: "ห้องอาบ" }, { id: 2, name: "ห้องส้วม" }] },
    { id: 4, name: "ครัว", lights: [{ id: 1, name: "ครัว" }] },
    { id: 5, name: "ห้องแรก", lights: [{ id: 1, name: "ห้องแรก" }] },
    { id: 6, name: "ห้องกลาง", lights: [{ id: 1, name: "ห้องกลาง" }] }
];

let html = '';

zoneConfig.forEach(zone => {
    let zoneActionsHtml = '';
    if (zone.lights.length > 1) {
        zoneActionsHtml = `
                <div class="zone-actions">
                    <button class="btn btn-sm btn-outline zone-btn-on" data-zone="${zone.id}">On All</button>
                    <button class="btn btn-sm btn-outline zone-btn-off" data-zone="${zone.id}">Off All</button>
                </div>`;
    }

    const headerHtml = `
            <div class="zone-header">
                <h2 class="zone-title">📍 ${zone.name}</h2>${zoneActionsHtml}
            </div>`;

    let lightsHtml = '';
    zone.lights.forEach(light => {
        lightsHtml += `
                <div class="light-item" id="zone${zone.id}-light${light.id}">
                    <div class="light-info">
                        <span class="light-icon">💡</span>
                        <div class="light-text-group">
                            <span class="light-name">${light.name}</span>
                            <div class="light-stats" id="stats-${zone.name}_${light.name}">0.00 hrs | 0.00 ฿</div>
                        </div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-z${zone.id}-l${light.id}" data-zone="${zone.id}" data-light="${light.id}">
                        <span class="slider"></span>
                    </label>
                </div>`;
    });

    const lightsContainer = `
            <div class="lights-container">${lightsHtml}
            </div>`;

    html += `
        <div class="zone-card">${headerHtml}${lightsContainer}
        </div>`;
});

fs.writeFileSync('generated_zones.txt', html);
