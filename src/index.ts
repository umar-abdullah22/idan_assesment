import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

// Interfaces
interface Board {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
}

interface Column {
  id: string;
  title: string;
  type: string;
}

interface ConnectedBoardItemResponse {
  data: {
    boards: {
      items_page: {
        items: ConnectedBoardItem[];
      };
    }[];
}
}

interface ConnectedBoardItem {
  id: string;
  name: string;
  column_values?: {
    id: string;
    value:string
    type: string
  }[]
}

class MondayAPIClient {
  private apiToken: string;
  private apiUrl: string;

  constructor() {
    this.apiToken = process.env.MONDAY_API_TOKEN || '';
    if (!this.apiToken) {
      throw new Error('API token is required. Please set the MONDAY_API_TOKEN environment variable.');
    }
    this.apiUrl = process.env.MONDAY_BASE_URL || 'https://api.monday.com/v2';
  }

  private async request<T = any>(query: string): Promise<T> {
    try {
      const response = await axios.post(
        this.apiUrl,
        { query },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.apiToken,
          },
        }
      );

      if (!response.data) {
        throw new Error(`GraphQL Error: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP Error: ${error.message}`);
      }
      throw error;
    }
  }

  // Task 1: Fetch all boards
  async getBoards(): Promise<Board[]> {
    const query = `
      query {
        boards {
          id
          name
        }
      }
    `;
    const response = await this.request<{ data: { boards: Board[] } }>(query);
    return response.data.boards;
  }

  // Task 2: Fetch items from a specific board
  async getItemsFromBoard(boardId: string): Promise<Item[]> {
    const query = `
      query {
        boards (ids: ${boardId}) {
          items_page {
            items {
              id
              name
            }
          }
        }
      }
    `;
    const response = await this.request<{ data: { boards: { items_page: { items: Item[] } }[] } }>(query);
    return response.data.boards[0].items_page.items;
  }

  // Fetch board columns
  async fetchBoardColumns(boardId: string): Promise<Column[]> {
    const query = `
      query {
        boards (ids: ${boardId}) {
          columns {
            id
            title
            type
          }
        }
      }
    `;
    const response = await this.request<{ data: { boards: { columns: Column[] }[] } }>(query);
    return response.data.boards[0].columns;
  }

  // Task 3: Fetch data from a Connected Boards column
  async fetchConnectedBoardsColumnData(boardId: string, columnId: string): Promise<ConnectedBoardItem[]> {
    const query = `
      query {
        boards (ids: ${boardId}) {
          items_page {
            items {
              id
              name
              column_values {
                column {
                  title
                }
                id
                type
                value
              }
            }
          }
        }
      }
    `;
    const response : ConnectedBoardItemResponse = await this.request(query);
    const items = response.data.boards[0].items_page.items;

    const connectedItems: ConnectedBoardItem[] = [];

    for (const item of items) {
      const columnValue = item?.column_values?.find((col) => col.id === columnId);
      if (columnValue && columnValue.type === 'board_relation') {
        connectedItems.push({
          id: item.id,
          name: item.name,
        });
      }
    }

    return connectedItems;
  }
}

// Main runner
async function main() {
  try {
    const client = new MondayAPIClient();

    // Task 1: Get boards
    const boards = await client.getBoards();

    if (boards.length === 0) {
      console.log('No boards found.');
    } else {
      boards.forEach(board => {
        console.log(`Board ID: ${board.id} | Board Name: ${board.name}`);
      });
    }

    // Task 2: Get items from the first board
    const specificBoard = boards[0].id;
    const items = await client.getItemsFromBoard(specificBoard);

    if (items.length === 0) {
      console.log('No items found in the board.');
    } else {
      items.forEach((item: any) => {
        console.log(`Item ID: ${item.id} | Item Name: ${item.name}`);
      });
    }

    // Fetch columns
    const columns = await client.fetchBoardColumns(specificBoard);

    // Task 3: Fetch connected board column data
    for (const column of columns) {
      console.log(`Column ID: ${column.id} | Column Title: ${column.title} | Column Type: ${column.type}`);
      const connectedBoardsColumn = columns.find(col => col.type === 'board_relation');
      console.log(`Found Connected Boards Column ID: ${connectedBoardsColumn?.id} | Title: ${connectedBoardsColumn?.title}`);
      if (connectedBoardsColumn?.id) {
        const connectedBoard = await client.fetchConnectedBoardsColumnData(specificBoard, connectedBoardsColumn.id);
        console.log('Connected Boards Column Data:', connectedBoard);
      }
    }
  } catch (error) {
    console.error('Error fetching boards:', error);
  }
}

if (require.main === module) {
  main();
}
