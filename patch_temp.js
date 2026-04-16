const fs = require('fs');
let code = fs.readFileSync('app/Rescuer/UserRescuerDashboardScreen.js', 'utf8');

const sIdx = code.indexOf('  // Get filtered reports based on current filter');
const eIdx = code.indexOf('  // Render Dashboard Tab');
if(sIdx > -1 && eIdx > -1) {
   code = code.substring(0, sIdx) + code.substring(eIdx);
} else {
   console.log('Not found1');
}

const filterStart = code.indexOf('        {/* Filter Chips */}');
const sectStart = code.indexOf('        {/* Reports Section */}');
if (filterStart > -1 && sectStart > -1) {
   code = code.substring(0, filterStart) + code.substring(sectStart);
} else {
   console.log('Not found2');
}

code = code.replace(/filteredReports\.length/g, 'sortedAvailableReports.length');
code = code.replace(/filteredReports\.map/g, 'sortedAvailableReports.map');
code = code.replace(/\{reportFilter === [\s\S]*?completed rescues yet'\}/g, "'No rescue reports available at the moment'");

fs.writeFileSync('app/Rescuer/UserRescuerDashboardScreen.js', code);
console.log('Done script');
