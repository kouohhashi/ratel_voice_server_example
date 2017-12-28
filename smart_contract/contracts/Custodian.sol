pragma solidity ^0.4.18;


contract Custodian {
  // fallback for loancoin
  function tokenFallback(address _address, uint256 _value, bytes _data) public {
  }
}

contract RatelExampleToken {

  // locked
  mapping (address => uint256) public lockedValue;

  // ERC20 State
  mapping (address => uint256) public balances;
  mapping (address => mapping (address => uint256)) public allowances;
  uint256 public totalSupply;

  // Human State
  string public name;
  uint8 public decimals;
  string public symbol;
  string public version;

  // Minter Address
  address public centralMinter;

  // Custodian Address
  address public custodianAddress;

  // Backed By Ether State
  uint256 public buyPrice;
  uint256 public sellPrice;

  // on sale?
  bool public onSale;

  // Modifiers: only Minter
  modifier onlyMinter {
    if (msg.sender != centralMinter) revert();
    _;
  }

  // Modifiers: onSale?
  modifier onlyOnSale {
    if (onSale != true) revert();
    _;
  }

  // ERC20 Events
  event Transfer(address indexed _from, address indexed _to, uint256 _value, bytes _data);
  event Approval(address indexed _owner, address indexed _spender, uint256 _value);

  // Constructor
  function RatelExampleToken(uint256 _initialAmount) public {
    balances[msg.sender] = _initialAmount;
    totalSupply = _initialAmount;
    name = "Ratel Network Token";
    decimals = 18;
    symbol = "RNT";
    version = "0.1";
    centralMinter = msg.sender;
    buyPrice = 100000000000000;
    sellPrice = 99000000000000;
    onSale = false;
  }

  // check if address is contract or not
  function isContract(address _address) private view returns (bool is_contract) {
    uint length;
    assembly {
      length := extcodesize(_address)
    }
    if (length > 0) {
      return true;
    } else {
      return false;
    }
  }

  // ERC20 Methods
  function balanceOf(address _address) constant public returns (uint256 balance) {
    return balances[_address];
  }

  function allowance(address _owner, address _spender) constant public returns (uint256 remaining) {
    return allowances[_owner][_spender];
  }

  // ERC 20
  function transfer(address _to, uint256 _value) public returns (bool success) {
    return transfer(_to, _value, "");
  }

  // ERC 223
  function transfer(address _to, uint256 _value, bytes _data) public returns (bool success) {

    if (isContract(_to)) {

      if(balances[msg.sender] < _value) revert();
      if(balances[_to] + _value < balances[_to]) revert();
      balances[msg.sender] -= _value;
      balances[_to] += _value;

      Custodian receiver = Custodian(_to);
      receiver.tokenFallback(msg.sender, _value, _data);

      Transfer(msg.sender, _to, _value, _data);
      return true;
    } else {
      // nomal address
      if(balances[msg.sender] < _value) revert();
      if(balances[_to] + _value < balances[_to]) revert();
      balances[msg.sender] -= _value;
      balances[_to] += _value;
      Transfer(msg.sender, _to, _value, "");
      return true;
    }
  }

  function approve(address _spender, uint256 _value) public returns (bool success) {
    if (allowances[msg.sender][_spender] + _value < allowances[msg.sender][_spender]) revert();
    allowances[msg.sender][_spender] += _value;
    Approval(msg.sender, _spender, _value);
    return true;
  }

  function transferFrom(address _owner, address _to, uint256 _value) public returns (bool success) {
    if(balances[_owner] < _value) revert();
    if(balances[_to] + _value < balances[_to]) revert();
    if(allowances[_owner][msg.sender] < _value) revert();
    balances[_owner] -= _value;
    balances[_to] += _value;
    allowances[_owner][msg.sender] -= _value;

    Transfer(_owner, _to, _value, "transferFrom");
    return true;
  }

  // Minter Functions
  function mint(uint256 _amountToMint) public onlyMinter {
    balances[centralMinter] += _amountToMint;
    totalSupply += _amountToMint;
    Transfer(this, centralMinter, _amountToMint, "mint");
  }

  function transferMinter(address _address) public onlyMinter {
    centralMinter = _address;
  }

  function transferCustodian(address _address) public onlyMinter {
    custodianAddress = _address;
  }

  function updateSale(bool _onSale) public onlyMinter {
    onSale = _onSale;
  }

  // Use transfer to issue token
  // Revoke token after verifying contribution
  function revokeToken( address _address, uint256 _value ) public onlyMinter returns (bool success) {

    // approve
    if (allowances[_address][centralMinter] + _value < allowances[_address][centralMinter]) revert();
    allowances[_address][centralMinter] += _value;
    Approval(msg.sender, centralMinter, _value);

    // transfer from
    transferFrom(_address, centralMinter, _value);

    return true;
  }

  // lock and unlock fund. we use this feature when move token to main net
  function lockToken( uint256 _value ) public returns (bool success) {

    if (lockedValue[msg.sender] != 0) revert();

    // transfer value
    transfer(custodianAddress, _value, "");

    // lock value
    lockedValue[msg.sender] = _value;

    // approve
    if (allowances[msg.sender][centralMinter] + _value < allowances[msg.sender][centralMinter]) revert();
    allowances[msg.sender][centralMinter] += _value;
    Approval(msg.sender, centralMinter, _value);

    return true;
  }

  // move token to central minter because token was moved to main net successfully
  function moveTokenToMinter( address _address ) public onlyMinter returns (bool success) {
    if (lockedValue[_address] == 0) revert();
    transferFrom(custodianAddress, centralMinter, lockedValue[_address]);
    lockedValue[_address] = 0;
    return true;
  }

  // move token back to original owner because token was NOT moved to main net successfully
  function unlockToken( address _address) public onlyMinter returns (bool success) {
    if (lockedValue[_address] == 0) revert();
    transferFrom(custodianAddress, _address, lockedValue[_address]);
    lockedValue[_address] = 0;
    return true;
  }


  // Backed By Ether Methods
  // Must create the contract so that it has enough Ether to buy back ALL tokens on the market, or else the contract will be insolvent and users won't be able to sell their tokens
  function setPrices(uint256 _newSellPrice, uint256 _newBuyPrice) public onlyMinter {
    sellPrice = _newSellPrice;
    buyPrice = _newBuyPrice;
  }

  function buy() payable public onlyOnSale returns (uint amount) {
    amount = msg.value / buyPrice;
    // Validate there are enough tokens minted
    if(balances[centralMinter] < amount) revert();
    balances[centralMinter] -= amount;
    balances[msg.sender] += amount;
    Transfer(centralMinter, msg.sender, amount, "buy");
    return amount;
  }

  function sell(uint _amount) public onlyOnSale returns (uint revenue) {
    // Validate sender has enough tokens to sell
    if (balances[msg.sender] < _amount) revert();
    balances[centralMinter] += _amount;
    balances[msg.sender] -= _amount;
    revenue = _amount * sellPrice;
    if (!msg.sender.send(revenue)) {
      revert();
    } else {
      Transfer(msg.sender, centralMinter, _amount, "sell");
      return revenue;
    }
  }

  // kill contract itself
  function kill() onlyMinter public {
      selfdestruct(centralMinter);
  }

  // fallback for ether
  function() payable public {
    revert();
  }
}
