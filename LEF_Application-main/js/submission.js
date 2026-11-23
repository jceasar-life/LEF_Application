export async function submitDemo(client, id) {
  const { data, error } = await client.rpc(
    'submit_demo_application',
    { p_application_id: id }
  );

  if (error) throw error;
  if (data !== id) {
    throw new Error('Submission was not confirmed.');
  }

  return data;
}