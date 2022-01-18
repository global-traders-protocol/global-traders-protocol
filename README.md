# GT-Protocol

## Compile

Copy `example.env` to a new file called `.env` and fill the values in it.

```
npx hardhat compile
```

## Test

```
npx hardhat test
```

## Deploy GTP Token

Run:

```
npx hardhat run scripts/deploy-token.ts --network [Your Network]
```

## Deploy Vesting

Don't forget to paste GTP token address to `.env` variable `GTP`
Run:

```
npx hardhat run scripts/deploy-vesting.ts --network [Your Network]
```
