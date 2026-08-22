import { supabase } from './src/config/supabase';

async function run() {
    const { data, error } = await supabase.from('communities').select('name, members, member_count');
    if (error) {
        console.error(error);
        return;
    }
    console.log("Communities lists:");
    console.log(JSON.stringify(data, null, 2));
}

run();
