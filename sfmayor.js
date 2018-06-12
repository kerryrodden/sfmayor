const barWidth = 15;
const votesNotTransferred = "Not Transferred";
const startingRound = 5;
const finalRound = 9;

const margin = { top: 35, left: 125, bottom: 60, right: 50 };
const width = 800 - margin.left - margin.right;
const height = 550 - margin.top - margin.bottom;

const x = d3.scaleBand()
  .range([0, width]);

const y = d3.scaleLinear()
  .range([0, height]);

const color = d3.scaleOrdinal()
  .domain(["London Breed", "Mark Leno", "Jane Kim", "Richie Greenberg", "Angela Alioto", "Ellen Lee Zhou"])
  .range(["#4461ab", "#00b556", "#af1e23", "#ab47bc", "#fed304", "#f57c00"])
  .unknown(["var(--background-color)"]);

const g = initializeVisualization();

const promises = [d3.text("votes_by_round.csv"), d3.text("transfers.csv")];
Promise.all(promises).then(([rawVotes, rawTransfers]) => {
  visualizeData(rawVotes, rawTransfers);
});

// Process the received data and then render it as SVG
function visualizeData(rawVotes, rawTransfers) {
  const votes = processVotes(rawVotes);
  const transfers = processTransfers(rawTransfers);

  x.domain(d3.set(votes, d => d.round).values().sort());
  y.domain([0, d3.sum(votes.filter(d => d.round === startingRound), d => d.votes)]);

  // Desired sort order for candidates, based on descending number of votes in first round...
  const sortOrder = votes.filter(d => d.round === startingRound).sort((a, b) => d3.descending(a.votes, b.votes)).map(d => d.candidate);
  // ... but make sure votesNotTransferred is at the end.
  sortOrder.push(sortOrder.splice(sortOrder.findIndex(d => d === votesNotTransferred), 1)[0]);

  const votesByRound = d3.nest()
    .key(d => d.round)
    .sortKeys(d3.ascending)
    .sortValues((a, b) => d3.ascending(sortOrder.indexOf(a.candidate), sortOrder.indexOf(b.candidate)))
    .entries(votes);

  // Determine the
  votesByRound.forEach((round) => {
    let cumulativeVotes = 0;
    round.values.forEach((candidate) => {
      candidate.y1 = y(cumulativeVotes);
      candidate.y2 = y(cumulativeVotes + candidate.votes);
      cumulativeVotes += candidate.votes;
    })
  })

  // Votes carried over to the next round, for each continuing candidate
  const carryovers = [];
  votes.filter(d => d.round !== finalRound && d.candidate !== votesNotTransferred).forEach((d) => {
    if (votes.find((vote) => (vote.round === d.round + 1 && vote.candidate === d.candidate))) {
      carryovers.push({ round: d.round, from: d.candidate, to: d.candidate, votes: d.votes });
    } else {
      d.eliminated = true;
    }
  });

  carryovers.forEach((transfer) => {
    let source = votes.find(d => d.round === transfer.round && d.candidate === transfer.from);
    let target = votes.find(d => d.round === (transfer.round + 1) && d.candidate === transfer.to);
    transfer.source = { x: x(source.round) + barWidth, y: source.y1 + y(transfer.votes) / 2 };
    transfer.target = { x: x(target.round), y: target.y1 + y(transfer.votes) / 2 };
  });

  const transfersByRound = d3.nest()
    .key(d => d.round) // assumes one candidate eliminated per round
    .sortKeys(d3.ascending)
    .sortValues((a, b) => d3.ascending(sortOrder.indexOf(a.to), sortOrder.indexOf(b.to)))
    .entries(transfers);

  transfersByRound.forEach((round) => {
    let cumulativeVotes = 0;
    let totalTransferred = d3.sum(round.values, d => d.votes);
    round.values.forEach((transfer) => {
      transfer.percentage = transfer.votes / totalTransferred;
      let source = votes.find(d => d.round === transfer.round && d.candidate === transfer.from);
      let target = votes.find(d => d.round === (transfer.round + 1) && d.candidate === transfer.to);
      transfer.source = { x: x(source.round) + barWidth, y: source.y1 + y(cumulativeVotes) + y(transfer.votes) / 2 };
      transfer.target = { x: x(target.round), y: target.y2 - y(transfer.votes) / 2 };
      cumulativeVotes += transfer.votes;
    });
  });

  const renderLink = d3.linkHorizontal()
    .x(d => d.x)
    .y(d => d.y);

  showFinalists(votes);
  renderVotes(votes);
  renderCarryovers(carryovers, renderLink);
  renderTransfers(transfers, renderLink);
  labelCandidates(votes);
  labelRounds(votes);

  g.on("mouseleave", removeHighlights);
}

// Initial setup of SVG, with g element to draw in
function initializeVisualization() {
  const svg = d3.select("#content").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  // Make SVG gradient for each color, to white
  const gradients = svg.append("defs")
    .selectAll(".linearGradient")
    .data(color.domain())
    .enter().append("linearGradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "30%")
    .attr("id", d => gradientName(d));

  gradients.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", d => color(d));

  gradients.append("stop")
    .attr("offset", "90%")
    .attr("stop-color", "var(--background-color)");

  const g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Background rect to help with event handling
  g.append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "var(--background-color)");

  return g;
}

// Add bars showing the number of votes for each candidate in each round
function renderVotes(votes) {
  g.selectAll(".votes")
    .data(votes)
    .enter().append("rect")
    .attr("class", d => "votes round" + d.round)
    .classed("eliminated", d => d.eliminated)
    .attr("x", d => x(d.round))
    .attr("y", d => d.y1)
    .attr("width", barWidth)
    .attr("height", d => y(d.votes))
    .style("fill", d => color(d.candidate))
    .on("mouseenter", d => d.eliminated ? highlightTransfers(d.round) : null);
}

// Add links showing the votes carried over for the same candidate, between rounds
function renderCarryovers(carryovers, renderLink) {
  g.selectAll(".carryover")
    .data(carryovers)
    .enter().append("path")
    .attr("class", "carryover")
    .attr("d", renderLink)
    .attr("stroke-width", d => y(d.votes));
}

// Add the transfers from the eliminated candidate in each round, plus labels showing the actual percentages
function renderTransfers(transfers, renderLink) {
  g.selectAll(".transfer")
    .data(transfers)
    .enter().append("path")
    .attr("class", d => "transfer round" + d.round)
    .attr("d", renderLink)
    .attr("stroke", (d) => {
      return d.to === votesNotTransferred ? "url(#" + gradientName(d.from) + ")" : color(d.from);
    })
    .attr("stroke-width", d => y(d.votes))
    .on("mouseenter", d => highlightTransfers(d.round));

  const formatTransferPercentage = d3.format(".0%");
  g.selectAll(".transfer-percentage")
    .data(transfers)
    .enter().append("text")
    .attr("class", d => "transfer-percentage hidden round" + d.round)
    .attr("text-anchor", "end")
    .attr("x", d => d.target.x)
    .attr("dx", "-3")
    .attr("y", d => d.to === votesNotTransferred ? height + 6 : d.target.y - y(d.votes) / 2)
    .attr("dy", "-3")
    .text(d => formatTransferPercentage(d.percentage));
}

// Highlight the transfers for a given round
function highlightTransfers(round) {
  const transferSelector = ".transfer.round" + round;
  const labelSelector = ".eliminated-label.round" + round;
  const votesSelector = ".votes.round" + (round + 1) + ",.votes.round" + round + ".eliminated";
  g.selectAll(".votes,.carryover,.transfer,.eliminated-label,.finalist")
    .classed("faded", true);
  g.selectAll(transferSelector + "," + labelSelector + "," + votesSelector)
    .classed("faded", false);
  const transferPercentageSelector = ".transfer-percentage.round" + round;
  g.selectAll(".transfer-percentage")
    .classed("hidden", true);
  g.selectAll(transferPercentageSelector)
    .classed("hidden", false);
}

// Restore the visualization to its original, un-highlighted state
function removeHighlights() {
  g.selectAll(".faded")
    .classed("faded", false);
  g.selectAll(".transfer-percentage")
    .classed("hidden", true);
}

// Add labels for names of candidates
function labelCandidates(votes) {
  g.selectAll(".name-label")
    .data(votes.filter(d => d.round === startingRound))
    .enter().append("text")
    .text(d => d.candidate === votesNotTransferred ? "Votes not transferred" : d.candidate)
    .attr("class", "name-label")
    .attr("x", d => d.candidate === votesNotTransferred ? x(finalRound) + 10 : x(startingRound) - 10)
    .attr("y", d => (d.y1 + d.y2) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.candidate === votesNotTransferred ? "start" : "end")
    .style("fill", d => d.candidate === votesNotTransferred ? "var(--secondary-text-color)" : null);
}

// Add labels for the rounds, at top and bottom
function labelRounds(votes) {

  g.selectAll(".round-label")
    .data(d3.range(startingRound, finalRound + 1))
    .enter().append("text")
    .attr("class", "round-label")
    .attr("x", d => x(d) + barWidth / 2)
    .attr("y", -15)
    .attr("text-anchor", "middle")
    .text(d => "Round " + d);

  const labelData = votes.filter(d => d.eliminated);

  const eliminatedLabel = g.selectAll(".eliminated-label")
    .data(labelData)
    .enter().append("text")
    .attr("class", d => "eliminated-label round" + d.round)
    .attr("y", height + 25);

  eliminatedLabel
    .append("tspan")
    .attr("x", d => x(d.round) + barWidth / 2)
    .attr("text-anchor", "middle")
    .text(d => lastName(d.candidate)); // assumes one candidate eliminated per round

  eliminatedLabel
    .append("tspan")
    .attr("x", d => x(d.round) + barWidth / 2)
    .attr("dy", "1.4em")
    .attr("text-anchor", "middle")
    .text("eliminated");
}

// Add photos and percentages for the two finalists
function showFinalists(votes) {
  const finalists = votes.filter(d => d.round === finalRound).sort((a, b) => d3.descending(a.votes, b.votes)).slice(0, 2);
  const totalVotes = d3.sum(finalists, d => d.votes);
  const formatFinalPercentage = d3.format(".2%");

  const finalist = d3.select("#content").selectAll(".finalist")
    .data(finalists)
    .enter().append("div")
    .classed("finalist", true)
    .style("top", d => (d.y1) + 60 + "px")
    .style("left", (width + margin.right) + "px");

  finalist.append("img")
    .classed("photo", true)
    .style("border-color", d => color(d.candidate))
    .attr("src", d => "images/" + lastName(d.candidate) + ".jpg")
    .attr("alt", "");

  finalist.append("p")
    .text(d => d.candidate);

  finalist.append("p")
    .classed("percentage", true)
    .text(d => formatFinalPercentage(d.votes / totalVotes));
}

function lastName(candidate) {
  return candidate.split(" ").pop();
}

function gradientName(candidate) {
  return "gradient-" + lastName(candidate);
}

function processVotes(text) {
  const csv = d3.transpose(d3.csvParseRows(text));
  const headers = csv.shift();
  const processed = [];
  csv.forEach((row, rowIndex) => {
    row.forEach((value, valueIndex) => {
      const votes = parseInt(value);
      if (votes > 0) {
        processed.push({ round: rowIndex + startingRound, candidate: headers[valueIndex], votes: votes });
      }
    });
  });
  return processed;
}

function processTransfers(text) {
  const csv = d3.transpose(d3.csvParseRows(text));
  const headers = csv.shift();
  headers.shift();
  const transfers = [];
  csv.forEach((row, rowIndex) => {
    const eliminated = row.shift();
    row.forEach((value, valueIndex) => {
      const votes = parseInt(value);
      if (votes > 0) {
        transfers.push({ round: rowIndex + startingRound, from: eliminated, to: headers[valueIndex], votes: votes });
      }
    });
  });
  return transfers;
}
