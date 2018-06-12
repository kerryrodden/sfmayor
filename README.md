# Visualization of the election results for San Francisco mayor 2018

## View the visualization

[on Github Pages](https://kerryrodden.github.io/sfmayor/)

## Data source

[City of San Francisco, Department of Elections](https://sfelections.sfgov.org/june-5-2018-election-results-detailed-reports)

## Photo credits

- [London Breed](https://commons.wikimedia.org/wiki/File:London_Breed.jpg) by LBStaff (public domain), Wikimedia Commons
- [Mark Leno](https://commons.wikimedia.org/wiki/File:Laughing_Leno.jpg) by Sacarasso ([CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)), Wikimedia Commons

## Notes on the design

Because San Francisco uses a ranked-choice voting system, and that made a big difference to the outcome, the main design goal here was to emphasize the transfers of votes between candidates, and de-emphasize the votes that were simply carried over between rounds.

The visualization is like a cross between a Sankey diagram (to show flows) and a stacked bar chart (to show change in composition over time). I'm not normally a fan of stacked bar charts because of the loss of a common baseline, but in this case, communicating the exact relative sizes of the bars was not a primary design goal.

## Acknowledgements

Thanks to Susie Lu, Marcin Wichary, Rich Ridlen, Rick Boardman, Zan Armstrong, Elijah Meeks, and Adam Pearce for design critique. I didn't implement all of their suggestions and any remaining flaws are entirely my responsibility :)
