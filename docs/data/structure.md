# Proposed data access patterns (DAP)

How will people use Marble?

You'll have a use-case in mind already, such as "I want to enrich a list of names of people I collected at an event and send them a personalized email.


- Create a project (with a name)
- Create a table to manage / think about what inputs you'll want
- Establish a source -- webhook // csv(?) and pipe the inputs from that source into the table

Then in my mind it will be "I want to create a column (or columns)" -- but FIRST -- we need to think about the operations we're going to be getting out of that column... What does the input and output look like there?

Then we have to have a program ready-to-go. So we'll have to go and think about, then manufacture, and then test whatever programs we need. -- Not to mention(!!) that these programs rely on API keys for different 

`marble projects create "jerry"`

`marble tables create --project "jerry"`

`marble programs create "big_dog"`

```ts

const marble = new MarbleClient({ options });

const project = await marble.projects.create({
  name: "Post-event contact"
});

const enrichmentTable = await project.tables.create("Enriched contacts");
const inputSource = await project.sources.create();

await inputSource.mapTo(enrichmentTable, {
  name: "name",
  
}

await enrichmentTable.addRows(20);



