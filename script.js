
(() => {

  function promisifyCSV(path) {
    // plotly's old D3 version does not support promises
    return new Promise((resolve, reject) => {
      Plotly.d3.csv(path, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }
  
  let covid
  let reportedDates

  Promise.all([
    promisifyCSV('https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv'),
    promisifyCSV('country-mapping.csv'),
  ]).then(function([covidData, countries]) {
    reportedDates = Object.keys(covidData[0]).slice(4)
    covidData.forEach(record => {
      const matchingCountry = countries.find(country => country['country'] === record['Country/Region'])
      if (matchingCountry) {
        // disambiguate the parent region of Micronesia from the country of Micronesia
        if (record['Country/Region'] === 'Micronesia') record['Country/Region'] = 'Micronesia (Federated States of)'
        record.continent = matchingCountry.continent
        record.sub_region = matchingCountry.sub_region
      } else {
        console.log('New location missing', record)
      }
    })
    covid = covidData.filter(locations => location.continent !== null) // remove new items recently added
    draw()

    document.getElementById('chart').on('plotly_restyle', function([args]) {
      draw(args.date)
    })
  }).catch(function(err) {
    // handle error here
    console.log(err)
  })
  

  const draw = (date) => {

    let labels = []
    let parents = []
    let values = []
  
    const dateColumn = date || reportedDates[reportedDates.length -1]
   ;['Province/State', 'Country/Region', 'sub_region', 'continent'].forEach((columnName, index, list) => {
      const nextColumnName = (index < list.length - 1)? list[index + 1] : ''
      const nonNullRows = covid.filter(row => row[columnName] !== '')
      const uniqueLabels = [...new Set(nonNullRows.map(row => row[columnName]))]
      uniqueLabels.forEach(uniqueLabel => {
        const matching = nonNullRows.filter(row => row[columnName] === uniqueLabel)
        const arrSum = matching.reduce((acc, row) => acc + parseInt(row[dateColumn]), 0)
        const match = nonNullRows.find(row => row[columnName] === uniqueLabel)
        values.push(arrSum)
        labels.push(uniqueLabel)
        parents.push(match[nextColumnName]||'World')
      })
    })
    labels.push('World')
  
    const total = covid.reduce((acc, row) => acc + parseInt(row[dateColumn]), 0)
    values.push(total)
    parents.push('')
  
    const data = [{
      type: 'sunburst',
      labels: labels,
      parents: parents,
      values:  values,
      leaf: {opacity: 0.4},
      marker: {line: {width: 2}},
      branchvalues: 'total',
      hovertemplate: '%{value:,} confirmed cases <extra>%{label}</extra>',
      textposition: 'inside',
      insidetextorientation: 'radial'
    }]

    var layout = {
     // title: 'COVID-19 Cases by Region and Country',
      margin: {l: 10, r: 10, b: 10, t:0},
      sliders: [{
        pad: {l: 20, r: 20, b: 20, t:0},
        active: reportedDates.length - 1,
        currentvalue: {
          value: dateColumn,
          // xanchor: 'top',
          prefix: 'As of: ',
          font: {
            color: '#888',
            size: 20
          }
        },
         steps: reportedDates.map(date => {
            return {
              method: 'restyle',
              'args': ['date', date],
              label: date
            }
          })
       }]
    }
    
    if (!date) Plotly.react('chart', data, layout, {responsive: true})
    else Plotly.animate('chart', {data: data})

  }

})()




