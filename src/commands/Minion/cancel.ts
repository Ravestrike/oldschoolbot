import { KlasaMessage, CommandStore } from 'klasa';

import { BotCommand } from '../../lib/BotCommand';
import getActivityOfUser from '../../lib/util/getActivityOfUser';
import removeSubTasksFromActivityTask from '../../lib/util/removeSubTasksFromActivityTask';
import { Activity, Time } from '../../lib/constants';
import { requiresMinion } from '../../lib/minions/decorators';
import { tickerTaskFromActivity } from '../../lib/minions/functions/tickerTaskFromActivity';

const options = {
	max: 1,
	time: 10000,
	errors: ['time']
};

export default class extends BotCommand {
	public constructor(store: CommandStore, file: string[], directory: string) {
		super(store, file, directory, {
			oneAtTime: true,
			cooldown: 180
		});
	}

	@requiresMinion
	async run(msg: KlasaMessage) {
		const currentTask = getActivityOfUser(this.client, msg.author);

		if (!currentTask) {
			throw `${msg.author.minionName} isn't doing anything at the moment, so there's nothing to cancel.`;
		}

		if (currentTask.finishDate - Date.now() < Time.Minute * 1.5) {
			throw `${msg.author.minionName} is already on their way back from the trip, returning in around a minute, no point in cancelling now!`;
		}

		if (currentTask.type === Activity.GroupMonsterKilling) {
			throw `${msg.author.minionName} is in a group PVM trip, their team wouldn't like it if they left!`;
		}

		const taskTicker = tickerTaskFromActivity(currentTask.type);

		const cancelMsg = await msg.channel.send(
			`${msg.author} ${msg.author.minionStatus}\n Say \`confirm\` if you want to call your minion back from their trip. ` +
				`They'll **drop** all their current **loot and supplies** to get back as fast as they can, so you won't receive any loot from this trip if you cancel it, and you will lose any supplies you spent to start this trip, if any.`
		);

		try {
			await msg.channel.awaitMessages(
				_msg =>
					_msg.author.id === msg.author.id && _msg.content.toLowerCase() === 'confirm',
				options
			);
		} catch (err) {
			return cancelMsg.edit(`Halting cancellation of minion task.`);
		}

		await removeSubTasksFromActivityTask(this.client, taskTicker, [currentTask.id]);

		return msg.send(
			`${msg.author.minionName}'s trip was cancelled, and they're now available.`
		);
	}
}
