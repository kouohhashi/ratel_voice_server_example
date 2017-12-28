var RatelExampleToken = artifacts.require("./RatelExampleToken.sol");
var Custodian = artifacts.require("./Custodian.sol");

module.exports = function(deployer) {
  deployer.deploy(RatelExampleToken, 1000000, { gas: 4700000 });
  deployer.deploy(Custodian,{ gas: 4700000 });
};
