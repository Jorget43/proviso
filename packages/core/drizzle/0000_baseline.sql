CREATE TABLE `actualsSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`useActualsProjections` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `allowanceSchedule` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`memberId` text NOT NULL,
	`amount` real NOT NULL,
	`dayOfWeek` integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `annualExpense` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`cat` text NOT NULL,
	`amt` real NOT NULL,
	`month` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`amt` real NOT NULL,
	`isOffset` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categorisationRule` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`pattern` text NOT NULL,
	`cat` text NOT NULL,
	`source` text DEFAULT 'user' NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `childcareSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`enabled` integer DEFAULT false NOT NULL,
	`costPerDay` real DEFAULT 130 NOT NULL,
	`daysPerWeek` integer DEFAULT 3 NOT NULL,
	`numChildren` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `debt` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`amt` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `donation` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`charity` text NOT NULL,
	`abn` text DEFAULT '' NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`financialYr` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`transactionId` text,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expense` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`cat` text NOT NULL,
	`name` text NOT NULL,
	`freq` text NOT NULL,
	`amt` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `helpDebtDetail` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person` text NOT NULL,
	`financialYearEnding` integer NOT NULL,
	`openingFyBalance` real DEFAULT 0 NOT NULL,
	`estimatedWithheld` real DEFAULT 0 NOT NULL,
	`voluntaryRepayments` real DEFAULT 0 NOT NULL,
	`cpiRate` real DEFAULT 3.5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `householdSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person1Name` text DEFAULT 'You' NOT NULL,
	`person2Name` text DEFAULT 'Partner' NOT NULL,
	`partnerEnabled` integer DEFAULT false NOT NULL,
	`onboardingDone` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `incomeSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`taxMode` integer DEFAULT true NOT NULL,
	`person1FTE` real DEFAULT 0 NOT NULL,
	`person2FTE` real DEFAULT 0 NOT NULL,
	`person1HasHELP` integer DEFAULT false NOT NULL,
	`person2HasHELP` integer DEFAULT false NOT NULL,
	`person1MonthlyNet` real DEFAULT 0 NOT NULL,
	`person2MonthlyNet` real DEFAULT 0 NOT NULL,
	`person1Age` integer DEFAULT 30 NOT NULL,
	`person2Age` integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `investmentParcel` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person` text NOT NULL,
	`name` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`purchasePrice` real DEFAULT 0 NOT NULL,
	`purchaseDate` text NOT NULL,
	`currentPrice` real DEFAULT 0 NOT NULL,
	`sellYear` integer
);
--> statement-breakpoint
CREATE TABLE `lifePhase` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`monthlyAmt` real NOT NULL,
	`startYear` integer NOT NULL,
	`endYear` integer NOT NULL,
	`cat` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mortgageSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`balance` real DEFAULT 0 NOT NULL,
	`rate` real DEFAULT 6 NOT NULL,
	`payment` real DEFAULT 0 NOT NULL,
	`offsetBal` real DEFAULT 0 NOT NULL,
	`endDate` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `netWorthSnapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`takenAt` text NOT NULL,
	`totalAssets` real,
	`totalDebts` real,
	`netWorth` real NOT NULL,
	`source` text DEFAULT 'auto' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oneOff` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`name` text NOT NULL,
	`amt` real NOT NULL,
	`year` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pocketMoneyTx` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`memberId` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`date` text NOT NULL,
	`category` text DEFAULT 'general' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projectionSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person1Growth` real DEFAULT 3.5 NOT NULL,
	`person2Growth` real DEFAULT 3 NOT NULL,
	`expInflNear` real DEFAULT 4 NOT NULL,
	`expInfl` real DEFAULT 2.5 NOT NULL,
	`childcareInfl` real DEFAULT 6 NOT NULL,
	`propGrowth` real DEFAULT 3.5 NOT NULL,
	`savingsRate` real DEFAULT 10 NOT NULL,
	`investReturn` real DEFAULT 3.5 NOT NULL,
	`projYears` integer DEFAULT 20 NOT NULL,
	`schoolFeesOn` integer DEFAULT false NOT NULL,
	`sfC1Start` integer DEFAULT 2032 NOT NULL,
	`sfC1ExitIdx` integer DEFAULT 13 NOT NULL,
	`sfC2Start` integer DEFAULT 2035 NOT NULL,
	`sfC2ExitIdx` integer DEFAULT 13 NOT NULL,
	`sfInfl` real DEFAULT 5 NOT NULL,
	`sfPresetKey` text,
	`parentalLeaveEnabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rentSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`enabled` integer DEFAULT false NOT NULL,
	`monthlyRent` real DEFAULT 0 NOT NULL,
	`annualIncreaseRate` real DEFAULT 5 NOT NULL,
	`purchasePlanEnabled` integer DEFAULT false NOT NULL,
	`targetPurchaseYear` integer DEFAULT 2031 NOT NULL,
	`targetPropertyValue` real DEFAULT 800000 NOT NULL,
	`depositPct` real DEFAULT 20 NOT NULL,
	`depositFromCash` real DEFAULT 0 NOT NULL,
	`depositFromInvestments` real DEFAULT 0 NOT NULL,
	`newMortgageRate` real DEFAULT 6 NOT NULL,
	`newMortgageTermYrs` integer DEFAULT 30 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schoolFeeLevel` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`level` text NOT NULL,
	`tuition` real DEFAULT 0 NOT NULL,
	`fixed` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suggestionState` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`cat` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `superHistory` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person` text NOT NULL,
	`financialYearEnding` integer NOT NULL,
	`concessionalCap` real NOT NULL,
	`concessionalUtilised` real NOT NULL,
	`totalSuperBalance` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `superSettings` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person1Balance` real DEFAULT 0 NOT NULL,
	`person1RetirementAge` integer DEFAULT 67 NOT NULL,
	`person1AdditionalContribs` real DEFAULT 0 NOT NULL,
	`person2Balance` real DEFAULT 0 NOT NULL,
	`person2RetirementAge` integer DEFAULT 67 NOT NULL,
	`person2AdditionalContribs` real DEFAULT 0 NOT NULL,
	`sgRate` real DEFAULT 0.12 NOT NULL,
	`investmentReturn` real DEFAULT 0.06 NOT NULL,
	`fundFeePercent` real DEFAULT 0.005 NOT NULL,
	`inflationRate` real DEFAULT 0.04 NOT NULL,
	`desiredRetirementIncome` real DEFAULT 60000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`date` text NOT NULL,
	`ym` text NOT NULL,
	`description` text NOT NULL,
	`amt` real NOT NULL,
	`cat` text NOT NULL,
	`originalCat` text NOT NULL,
	`catSource` text NOT NULL,
	`lumpy` integer DEFAULT false NOT NULL,
	`importedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workExpense` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`financialYr` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`transactionId` text,
	`receiptRef` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workPhase` (
	`id` text PRIMARY KEY NOT NULL,
	`deletedAt` text,
	`person` text NOT NULL,
	`year` integer NOT NULL,
	`days` integer NOT NULL
);
