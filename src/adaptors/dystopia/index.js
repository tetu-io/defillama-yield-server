const { request, gql } = require('graphql-request');

const utils = require('../utils');

const urlPolygon = 'https://api.thegraph.com/subgraphs/name/dystopia-exchange/dystopia';

const buildPool = (entry, chainString) => {
  const symbol = utils.formatSymbol(
    `${entry['token0'].symbol}-${entry['token1'].symbol}`
  );
  return {
    pool: entry.id,
    chain: utils.formatChain(chainString),
    project: 'dystopia',
    symbol,
    tvlUsd: entry.totalValueLockedUSD,
    apy: entry.apy,
  };
};

const topLvl = async (
  chainString,
  url,
  timestamp
) => {
  const [block, blockPrior] = await utils.getBlocks(chainString, timestamp, [
    url,
  ]);

  // pull data
  const queryC = gql`
  {
    pairs(first: 1000, orderBy: trackedReserveETH, orderDirection: desc block: {number: ${block}}) {
      id
      reserve0
      reserve1
      volumeUSD
      token0 {
        symbol
        id
      }
      token1 {
        symbol
        id
      }
    }
  }
`;
  let dataNow = await request(url, queryC);
  dataNow = dataNow['pairs'];

  // pull 24h offset data to calculate fees from swap volume
  const queryPriorC = gql`
  {
    pairs (first: 1000 orderBy: trackedReserveETH orderDirection: desc block: {number: ${blockPrior}}) {
      id 
      volumeUSD 
    }
  }
`;
  let dataPrior = await request(
    url,
    queryPriorC
  );
  dataPrior = dataPrior['pairs'];

  // calculate tvl
  dataNow = await utils.tvl(dataNow, chainString);
  // calculate apy
  let data = dataNow.map((el) => utils.apy({...el, feeTier: 500}, dataPrior, undefined));

  // build pool objects
  data = data.map((el) => buildPool(el, chainString));

  return data;
};

const main = async (timestamp = null) => {
  let data = await Promise.all([
    topLvl('polygon', urlPolygon, timestamp),
  ]);

  return data.flat();
};

module.exports = {
  timetravel: true,
  apy: main,
};
